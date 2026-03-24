import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import pool from "@/lib/db";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const patientId = await resolvePatientId(user.id);
  if (!patientId) return NextResponse.json({ alerts: [] });

  const { rows } = await pool.query(
    "SELECT id, type, severity, title, message, created_at FROM alerts WHERE patient_id = $1 AND read = false ORDER BY created_at DESC LIMIT 10",
    [patientId]
  );
  return NextResponse.json({ alerts: rows });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const patientId = await resolvePatientId(user.id);
  if (!patientId) return NextResponse.json({ error: "No hay registro de paciente" }, { status: 400 });

  const { alertIds } = await request.json();
  if (!Array.isArray(alertIds) || alertIds.length === 0) {
    return NextResponse.json({ error: "alertIds requerido" }, { status: 400 });
  }

  await pool.query(
    "UPDATE alerts SET read = true, read_at = NOW() WHERE id = ANY($1) AND patient_id = $2",
    [alertIds, patientId]
  );
  return NextResponse.json({ ok: true });
}
