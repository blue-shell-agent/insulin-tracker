import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import pool from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { patientId } = await params;
    const pid = parseInt(patientId, 10);

    if (isNaN(pid)) {
      return NextResponse.json({ error: "ID de paciente inválido" }, { status: 400 });
    }

    if (user.id !== pid && user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { rows } = await pool.query(
      `SELECT p.id, p.status, p.notes, p.created_at, p.expires_at,
              pi.medication_name, pi.dosage, pi.frequency, pi.instructions
       FROM prescriptions p
       JOIN prescription_items pi ON pi.prescription_id = p.id
       WHERE p.patient_id = $1 AND p.status = 'active'
       ORDER BY p.created_at DESC`,
      [pid]
    );

    return NextResponse.json({ medications: rows });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Get medications error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
