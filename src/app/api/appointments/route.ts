import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const upcoming = request.nextUrl.searchParams.get("upcoming") === "true";
  const timeFilter = upcoming ? "AND a.scheduled_at >= NOW()" : "";

  if (user.role === "doctor" || user.role === "admin") {
    // Doctor: get their appointments with patient info
    const { rows: doctorRows } = await pool.query(
      "SELECT id FROM doctors WHERE user_id = $1", [user.id]
    );
    if (doctorRows.length === 0) return NextResponse.json({ appointments: [] });

    const { rows } = await pool.query(`
      SELECT a.*, u.email as patient_email, u.first_name as patient_first_name, u.last_name as patient_last_name
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      JOIN users u ON u.id = p.user_id
      WHERE a.doctor_id = $1 ${timeFilter}
      ORDER BY a.scheduled_at ASC
    `, [doctorRows[0].id]);

    return NextResponse.json({ appointments: rows });
  }

  // Patient: get their appointments with doctor info
  const patientId = await resolvePatientId(user.id);
  if (!patientId) return NextResponse.json({ appointments: [] });

  const { rows } = await pool.query(`
    SELECT a.*, u.email as doctor_email, u.first_name as doctor_first_name, u.last_name as doctor_last_name
    FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
    JOIN users u ON u.id = d.user_id
    WHERE a.patient_id = $1 ${timeFilter}
    ORDER BY a.scheduled_at ASC
  `, [patientId]);

  return NextResponse.json({ appointments: rows });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (user.role !== "doctor" && user.role !== "admin") {
    return NextResponse.json({ error: "Solo los doctores pueden crear citas" }, { status: 403 });
  }

  const body = await request.json();
  const { patient_id, scheduled_at, duration_minutes, location, type, reason, notes } = body;

  if (!patient_id || !scheduled_at) {
    return NextResponse.json({ error: "Paciente y fecha requeridos" }, { status: 400 });
  }

  // Get doctor record
  const { rows: doctorRows } = await pool.query(
    "SELECT id FROM doctors WHERE user_id = $1", [user.id]
  );
  if (doctorRows.length === 0) {
    return NextResponse.json({ error: "No es doctor" }, { status: 403 });
  }
  const doctorId = doctorRows[0].id;

  // Verify doctor has access to this patient
  const { rows: access } = await pool.query(
    "SELECT 1 FROM patient_doctor WHERE doctor_id = $1 AND patient_id = $2 AND status = 'active'",
    [doctorId, patient_id]
  );
  if (access.length === 0) {
    return NextResponse.json({ error: "Sin acceso a este paciente" }, { status: 403 });
  }

  const { rows } = await pool.query(
    `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, duration_minutes, location, type, reason, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [patient_id, doctorId, scheduled_at, duration_minutes || 30, location || null, type || "in_person", reason || null, notes || null]
  );

  return NextResponse.json({ appointment: rows[0] }, { status: 201 });
}
