import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const alertId = parseInt(id, 10);
    if (isNaN(alertId)) {
      return NextResponse.json({ error: "ID de alerta inválido" }, { status: 400 });
    }

    const { rows } = await pool.query(
      `SELECT id, patient_id FROM alerts WHERE id = $1`,
      [alertId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 });
    }

    // Patients can only dismiss their own alerts; doctors/admins can dismiss any
    if (user.role === "patient" && rows[0].patient_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await pool.query(
      `UPDATE alerts SET read = TRUE, read_at = NOW() WHERE id = $1`,
      [alertId]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
