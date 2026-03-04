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

    if (isNaN(pid)) {
      return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
    }

    // Users can only view their own medications unless they're admin
    if (user.id !== pid && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { rows } = await pool.query(
      "SELECT * FROM medications WHERE patient_id = $1 AND active = TRUE ORDER BY created_at DESC",
      [pid]
    );

    return NextResponse.json({ medications: rows });
  } catch (error) {
    console.error("Get medications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
