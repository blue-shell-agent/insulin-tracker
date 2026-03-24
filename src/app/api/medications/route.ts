import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import pool from "@/lib/db";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const patientId = await resolvePatientId(user.id);
  if (!patientId) return NextResponse.json({ medications: [] });

  // Get active prescriptions with their items
  const { rows } = await pool.query(`
    SELECT pi.id, pi.medication_name as name, pi.dosage, pi.frequency, pi.instructions,
           p.status, p.expires_at
    FROM prescriptions p
    JOIN prescription_items pi ON pi.prescription_id = p.id
    WHERE p.patient_id = $1 AND p.status = 'active'
    ORDER BY pi.medication_name
  `, [patientId]);

  return NextResponse.json({ medications: rows });
}
