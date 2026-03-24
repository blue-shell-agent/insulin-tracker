import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { checkAndCreateAlert } from "@/lib/alerts";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let patientId: number | null;
  if (user.role === "admin") {
    const qp = request.nextUrl.searchParams.get("patient_id");
    patientId = qp ? Number(qp) : await resolvePatientId(user.id);
  } else {
    patientId = await resolvePatientId(user.id);
  }

  if (!patientId) return NextResponse.json({ measurements: [] });

  const { rows } = await pool.query(
    "SELECT id, type, value, unit, notes, recorded_at FROM measurements WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 50",
    [patientId]
  );
  return NextResponse.json({ measurements: rows });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const patientId = await resolvePatientId(user.id);
  if (!patientId) return NextResponse.json({ error: "No hay registro de paciente" }, { status: 400 });

  const body = await request.json();
  const { type, value, systolic, diastolic, notes } = body;

  if (!type) return NextResponse.json({ error: "Tipo requerido" }, { status: 400 });

  // Map measurement types to proper values and units
  let measValue: number;
  let unit: string;
  let measNotes = notes || null;

  if (type === "blood_pressure") {
    measValue = Number(systolic) || 0;
    unit = "mmHg";
    // Store diastolic in notes since DB has single value column
    measNotes = `diastolic:${diastolic || 0}${notes ? ` ${notes}` : ""}`;
  } else if (type === "glucemia") {
    measValue = Number(value) || 0;
    unit = "mg/dL";
  } else if (type === "weight") {
    measValue = Number(value) || 0;
    unit = "kg";
  } else {
    measValue = Number(value) || 0;
    unit = body.unit || "";
  }

  const { rows } = await pool.query(
    `INSERT INTO measurements (patient_id, type, value, unit, recorded_by, notes, recorded_at)
     VALUES ($1, $2, $3, $4, 'self', $5, NOW()) RETURNING *`,
    [patientId, type, measValue, unit, measNotes]
  );

  const measurement = rows[0];
  await checkAndCreateAlert(measurement);

  return NextResponse.json({ measurement });
}
