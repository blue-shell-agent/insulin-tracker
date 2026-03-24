import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import pool from "@/lib/db";

// Assign patient to doctor
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { doctor_user_id, patient_id: rawPatientId } = await request.json();
  if (!doctor_user_id || !rawPatientId) {
    return NextResponse.json({ error: "doctor_user_id y patient_id requeridos" }, { status: 400 });
  }

  // rawPatientId is actually a user_id from the admin UI, resolve to patients.id
  const { rows: patientLookup } = await pool.query(
    "SELECT id FROM patients WHERE user_id = $1",
    [rawPatientId]
  );

  let patient_id = rawPatientId;
  if (patientLookup.length > 0) {
    patient_id = patientLookup[0].id;
  } else {
    // Create patient record if it doesn't exist
    const { rows: newPatient } = await pool.query(
      "INSERT INTO patients (user_id) VALUES ($1) RETURNING id",
      [rawPatientId]
    );
    patient_id = newPatient[0].id;
  }

  // Get or create doctor record
  let { rows: doctorRows } = await pool.query(
    "SELECT id FROM doctors WHERE user_id = $1",
    [doctor_user_id]
  );

  if (doctorRows.length === 0) {
    // Verify user is a doctor
    const { rows: userRows } = await pool.query(
      "SELECT id, role FROM users WHERE id = $1",
      [doctor_user_id]
    );
    if (userRows.length === 0 || userRows[0].role !== "doctor") {
      return NextResponse.json({ error: "Usuario no es doctor" }, { status: 400 });
    }
    const { rows: newDoc } = await pool.query(
      "INSERT INTO doctors (user_id) VALUES ($1) RETURNING id",
      [doctor_user_id]
    );
    doctorRows = newDoc;
  }

  const doctorId = doctorRows[0].id;

  // Check if already assigned
  const { rows: existing } = await pool.query(
    "SELECT id, status FROM patient_doctor WHERE doctor_id = $1 AND patient_id = $2",
    [doctorId, patient_id]
  );

  if (existing.length > 0) {
    if (existing[0].status === "active") {
      return NextResponse.json({ error: "Ya asignado" }, { status: 409 });
    }
    // Reactivate
    await pool.query(
      "UPDATE patient_doctor SET status = 'active', assigned_at = NOW() WHERE id = $1",
      [existing[0].id]
    );
    return NextResponse.json({ message: "Reasignado" });
  }

  await pool.query(
    "INSERT INTO patient_doctor (doctor_id, patient_id, status, assigned_at) VALUES ($1, $2, 'active', NOW())",
    [doctorId, patient_id]
  );

  return NextResponse.json({ message: "Paciente asignado" }, { status: 201 });
}

// List assignments
export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { rows } = await pool.query(`
    SELECT pd.id, pd.status, pd.assigned_at,
      du.email as doctor_email, du.first_name as doctor_first_name, du.last_name as doctor_last_name,
      pu.email as patient_email, pu.first_name as patient_first_name, pu.last_name as patient_last_name,
      p.id as patient_id, d.id as doctor_id, du.id as doctor_user_id
    FROM patient_doctor pd
    JOIN doctors d ON d.id = pd.doctor_id
    JOIN users du ON du.id = d.user_id
    JOIN patients p ON p.id = pd.patient_id
    JOIN users pu ON pu.id = p.user_id
    ORDER BY pd.assigned_at DESC
  `);

  return NextResponse.json({ assignments: rows });
}

// Remove assignment
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await request.json();
  await pool.query("UPDATE patient_doctor SET status = 'inactive' WHERE id = $1", [id]);
  return NextResponse.json({ message: "Asignación removida" });
}
