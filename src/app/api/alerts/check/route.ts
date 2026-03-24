import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "doctor" && user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const created: { patient_id: number; type: string }[] = [];

      // Check for inactive patients (no glucemia measurement in >7 days)
      const { rows: inactivityRows } = await client.query(`
        INSERT INTO alerts (patient_id, type, severity, title, message)
        SELECT p.id, 'missed_logging', 'warning',
          'Sin registros recientes',
          'El paciente ' || u.email || ' no ha registrado glucemia en más de 7 días.'
        FROM patients p
        JOIN users u ON u.id = p.user_id
        WHERE u.role = 'patient'
          AND EXISTS (
            SELECT 1 FROM measurements m
            WHERE m.patient_id = p.id AND m.type = 'glucemia'
          )
          AND NOT EXISTS (
            SELECT 1 FROM measurements m
            WHERE m.patient_id = p.id
              AND m.type = 'glucemia'
              AND m.recorded_at > NOW() - INTERVAL '7 days'
          )
          AND NOT EXISTS (
            SELECT 1 FROM alerts a
            WHERE a.patient_id = p.id
              AND a.type = 'missed_logging'
              AND a.read = FALSE
          )
        RETURNING patient_id, type
      `);
      for (const row of inactivityRows) {
        created.push({ patient_id: row.patient_id, type: row.type });
      }

      // Check for critical measurements needing consultation
      const { rows: abnormalRows } = await client.query(`
        INSERT INTO alerts (patient_id, type, severity, title, message)
        SELECT DISTINCT a.patient_id, 'custom', 'critical',
          'Consulta necesaria',
          'El paciente tiene alertas críticas sin atender que requieren consulta.'
        FROM alerts a
        WHERE a.severity = 'critical'
          AND a.read = FALSE
          AND a.created_at > NOW() - INTERVAL '30 days'
          AND NOT EXISTS (
            SELECT 1 FROM alerts a2
            WHERE a2.patient_id = a.patient_id
              AND a2.type = 'custom'
              AND a2.title = 'Consulta necesaria'
              AND a2.read = FALSE
          )
        RETURNING patient_id, type
      `);
      for (const row of abnormalRows) {
        created.push({ patient_id: row.patient_id, type: row.type });
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
    console.error("Check alerts error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
