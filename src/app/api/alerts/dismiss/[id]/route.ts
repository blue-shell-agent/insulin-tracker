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
      // Fetch alert and verify access
      const { rows } = await pool.query(
        `SELECT id, patient_id FROM alerts WHERE id = $1`,
        [alertId]
      );

      if (rows.length === 0) {
        return NextResponse.json({ error: "Alert not found" }, { status: 404 });
      }

      // Patients can only dismiss their own alerts; doctors/admins can dismiss any
      if (user.role === "user" && rows[0].patient_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
