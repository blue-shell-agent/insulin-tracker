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
      return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
    }

    try {
      // Verify alert exists and user has access
      const { rows } = await pool.query(
        `SELECT a.id, a.patient_id FROM alerts a
         JOIN patients p ON p.id = a.patient_id
         WHERE a.id = $1 AND (p.doctor_id = $2 OR $3 = 'admin')`,
        [alertId, user.id, user.role]
      );

      if (rows.length === 0) {
        return NextResponse.json({ error: "Alert not found" }, { status: 404 });
      }

      await pool.query(
        `UPDATE alerts SET dismissed = TRUE, dismissed_at = NOW() WHERE id = $1`,
        [alertId]
      );

      return NextResponse.json({ ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("does not exist")) {
        return NextResponse.json({ error: "Alert not found" }, { status: 404 });
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
