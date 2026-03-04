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

      // Check for inactive patients (no glucose control in >7 days)
      try {
        const { rows: inactivityRows } = await client.query(`
          INSERT INTO alerts (patient_id, type, message)
          SELECT p.id, 'inactivity_reminder',
            'Patient ' || p.name || ' has not recorded glucose controls in over 7 days.'
          FROM patients p
          LEFT JOIN glucose_controls gc ON gc.patient_id = p.id
            AND gc.created_at > NOW() - INTERVAL '7 days'
          WHERE gc.id IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM alerts a
              WHERE a.patient_id = p.id
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
        // Table missing — skip gracefully
      }

      // Check for abnormal lab results needing consultation
      try {
        const { rows: abnormalRows } = await client.query(`
          INSERT INTO alerts (patient_id, type, message)
          SELECT lr.patient_id, 'consultation_needed',
            'Patient ' || p.name || ' has abnormal lab results requiring consultation.'
          FROM lab_results lr
          JOIN patients p ON p.id = lr.patient_id
          WHERE lr.is_abnormal = TRUE
            AND lr.created_at > NOW() - INTERVAL '30 days'
            AND NOT EXISTS (
              SELECT 1 FROM alerts a
              WHERE a.patient_id = lr.patient_id
                AND a.type = 'consultation_needed'
                AND a.dismissed = FALSE
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
