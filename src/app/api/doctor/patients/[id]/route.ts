import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import pool from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || (user.role !== "doctor" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: patientId } = await params;

  // Verify doctor has access to this patient
  const { rows: doctorRows } = await pool.query(
    "SELECT id FROM doctors WHERE user_id = $1",
    [user.id]
  );

  if (doctorRows.length === 0) {
    return NextResponse.json({ error: "No es doctor" }, { status: 403 });
  }

  const doctorId = doctorRows[0].id;

  const { rows: access } = await pool.query(
    "SELECT 1 FROM patient_doctor WHERE doctor_id = $1 AND patient_id = $2 AND status = 'active'",
    [doctorId, patientId]
  );

  if (access.length === 0) {
    return NextResponse.json({ error: "Sin acceso a este paciente" }, { status: 403 });
  }

  // Get patient info
  const { rows: patientRows } = await pool.query(`
    SELECT p.*, u.email, u.first_name, u.last_name
    FROM patients p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = $1
  `, [patientId]);

  if (patientRows.length === 0) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }

  // Get measurements (last 100)
  const { rows: measurements } = await pool.query(`
    SELECT id, type, value, unit, notes, recorded_at
    FROM measurements
    WHERE patient_id = $1
    ORDER BY recorded_at DESC
    LIMIT 100
  `, [patientId]);

  // Get alerts
  const { rows: alerts } = await pool.query(`
    SELECT id, type, severity, title, message, read, created_at
    FROM alerts
    WHERE patient_id = $1
    ORDER BY created_at DESC
    LIMIT 50
  `, [patientId]);

  // Get prescriptions
  const { rows: prescriptions } = await pool.query(`
    SELECT id, status, notes, created_at, signed_at, expires_at
    FROM prescriptions
    WHERE patient_id = $1 AND doctor_id = $2
    ORDER BY created_at DESC
  `, [patientId, doctorId]);

  // Get appointments
  const { rows: appointments } = await pool.query(`
    SELECT id, scheduled_at, duration_minutes, type, status, reason, notes, created_at
    FROM appointments
    WHERE patient_id = $1 AND doctor_id = $2
    ORDER BY scheduled_at DESC
  `, [patientId, doctorId]);

  return NextResponse.json({
    patient: patientRows[0],
    measurements,
    alerts,
    prescriptions,
    appointments,
  });
}
