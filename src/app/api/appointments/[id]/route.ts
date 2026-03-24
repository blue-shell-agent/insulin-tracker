import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import pool from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const appointmentId = parseInt(id, 10);
  if (isNaN(appointmentId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await request.json();

  // Fetch the appointment
  const { rows: apptRows } = await pool.query("SELECT * FROM appointments WHERE id = $1", [appointmentId]);
  if (apptRows.length === 0) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

  const appt = apptRows[0];

  if (user.role === "patient") {
    // Patient can only confirm their own appointments
    const patientId = await resolvePatientId(user.id);
    if (appt.patient_id !== patientId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (body.status !== "confirmed") {
      return NextResponse.json({ error: "Solo podés confirmar la cita" }, { status: 400 });
    }
    await pool.query("UPDATE appointments SET status = 'confirmed', updated_at = NOW() WHERE id = $1", [appointmentId]);
    return NextResponse.json({ ok: true });
  }

  // Doctor/admin can update any field
  const { rows: doctorRows } = await pool.query("SELECT id FROM doctors WHERE user_id = $1", [user.id]);
  if (doctorRows.length === 0 && user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const field of ["scheduled_at", "duration_minutes", "location", "type", "status", "reason", "notes"]) {
    if (body[field] !== undefined) {
      updates.push(`${field} = $${idx++}`);
      values.push(body[field]);
    }
  }

  if (updates.length === 0) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  updates.push(`updated_at = NOW()`);
  values.push(appointmentId);

  await pool.query(
    `UPDATE appointments SET ${updates.join(", ")} WHERE id = $${idx}`,
    values
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const appointmentId = parseInt(id, 10);
  if (isNaN(appointmentId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  // Verify access
  const { rows: apptRows } = await pool.query("SELECT * FROM appointments WHERE id = $1", [appointmentId]);
  if (apptRows.length === 0) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

  if (user.role === "doctor") {
    const { rows: doctorRows } = await pool.query("SELECT id FROM doctors WHERE user_id = $1", [user.id]);
    if (doctorRows.length === 0 || apptRows[0].doctor_id !== doctorRows[0].id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else if (user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await pool.query("UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [appointmentId]);
  return NextResponse.json({ ok: true });
}
