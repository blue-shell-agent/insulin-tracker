import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "doctor" && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const created: { patient_id: number; type: string }[] = [];

    // Check for inactive patients (no glucose control in >7 days)
    try {
      const { rows: inactive } = await pool.query(`
        SELECT p.id AS patient_id, p.name
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
      `);

      for (const row of inactive) {
        await pool.query(
          `INSERT INTO alerts (patient_id, type, message) VALUES ($1, $2, $3)`,
          [
            row.patient_id,
            "inactivity_reminder",
            `Patient ${row.name} has not recorded glucose controls in over 7 days.`,
          ]
        );
        created.push({ patient_id: row.patient_id, type: "inactivity_reminder" });
      }
    } catch (err: any) {
      if (!err.message?.includes("does not exist")) throw err;
      // Table missing — skip gracefully
    }

    // Check for abnormal lab results needing consultation
    try {
      const { rows: abnormal } = await pool.query(`
        SELECT lr.patient_id, p.name
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
      `);

      for (const row of abnormal) {
        await pool.query(
          `INSERT INTO alerts (patient_id, type, message) VALUES ($1, $2, $3)`,
          [
            row.patient_id,
            "consultation_needed",
            `Patient ${row.name} has abnormal lab results requiring consultation.`,
          ]
        );
        created.push({ patient_id: row.patient_id, type: "consultation_needed" });
      }
    } catch (err: any) {
      if (!err.message?.includes("does not exist")) throw err;
    }

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
