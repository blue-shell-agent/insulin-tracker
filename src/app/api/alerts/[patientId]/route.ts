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
      `SELECT id, patient_id, type, severity, title, message, read, created_at
       FROM alerts
       WHERE patient_id = $1 AND read = FALSE
       ORDER BY created_at DESC`,
      [pid]
    );

    return NextResponse.json({ alerts: rows });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Get alerts error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
