import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import pool from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    let user;
    try {
      user = await requireAuth(request);
    } catch (res) {
      if (res instanceof Response) return res;
      throw res;
    }

    const { patientId } = await params;
    const pid = parseInt(patientId, 10);

    if (user.id !== pid && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { rows } = await pool.query(
      "SELECT * FROM alerts WHERE patient_id = $1 ORDER BY alert_date DESC",
      [pid]
    );

    return NextResponse.json({ alerts: rows });
  } catch (error) {
    console.error("Get alerts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
