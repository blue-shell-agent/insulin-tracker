import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "doctor" && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const created: { patient_id: number; type: string }[] = [];

      // Check for inactive patients (no glucemia measurement in >7 days)
      // Only flag users who have at least one historical measurement
      // (avoids flagging brand-new patients)
      try {
        const { rows: inactivityRows } = await client.query(`
          INSERT INTO alerts (patient_id, type, message)
          SELECT u.id, 'inactivity_reminder',
            'Patient ' || u.email || ' has not recorded glucose measurements in over 7 days.'
          FROM users u
          WHERE u.role = 'user'
            AND EXISTS (
              SELECT 1 FROM measurements m
              WHERE m.patient_id = u.id AND m.type = 'glucemia'
            )
            AND NOT EXISTS (
              SELECT 1 FROM measurements m
              WHERE m.patient_id = u.id
                AND m.type = 'glucemia'
                AND m.measured_at > NOW() - INTERVAL '7 days'
            )
            AND NOT EXISTS (
              SELECT 1 FROM alerts a
              WHERE a.patient_id = u.id
                AND a.type = 'inactivity_reminder'
                AND a.dismissed = FALSE
            )
          RETURNING patient_id, type
        `);
        for (const row of inactivityRows) {
          created.push({ patient_id: row.patient_id, type: row.type });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        if (!msg.includes("does not exist")) throw err;
      }

      // Check for abnormal measurements needing consultation
      // Uses existing measurement alerts (severity = 'critical') that haven't been addressed
      try {
        const { rows: abnormalRows } = await client.query(`
          INSERT INTO alerts (patient_id, type, message)
          SELECT DISTINCT a.patient_id, 'consultation_needed',
            'Patient ' || u.email || ' has critical measurement alerts requiring consultation.'
          FROM alerts a
          JOIN users u ON u.id = a.patient_id
          WHERE a.severity = 'critical'
            AND a.acknowledged = FALSE
            AND a.created_at > NOW() - INTERVAL '30 days'
            AND NOT EXISTS (
              SELECT 1 FROM alerts a2
              WHERE a2.patient_id = a.patient_id
                AND a2.type = 'consultation_needed'
                AND a2.dismissed = FALSE
            )
          RETURNING patient_id, type
        `);
        for (const row of abnormalRows) {
          created.push({ patient_id: row.patient_id, type: row.type });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        if (!msg.includes("does not exist")) throw err;
      }

      await client.query("COMMIT");
      return NextResponse.json({ ok: true, created });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
