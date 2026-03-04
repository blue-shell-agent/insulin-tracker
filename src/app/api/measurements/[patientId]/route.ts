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
    const patientIdNum = Number(patientId);

    if (isNaN(patientIdNum)) {
      return NextResponse.json(
        { error: "Invalid patient ID" },
        { status: 400 }
      );
    }

    // Only allow own data or admin access
    if (user.id !== patientIdNum && user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT m.*, 
           json_agg(json_build_object('id', a.id, 'alert_type', a.alert_type, 'severity', a.severity, 'message', a.message, 'acknowledged', a.acknowledged)) 
           FILTER (WHERE a.id IS NOT NULL) AS alerts
         FROM measurements m
         LEFT JOIN alerts a ON a.measurement_id = m.id
         WHERE m.patient_id = $1
         GROUP BY m.id
         ORDER BY m.recorded_at DESC
         LIMIT $2 OFFSET $3`,
        [patientIdNum, limit, offset]
      ),
      pool.query(
        "SELECT COUNT(*) FROM measurements WHERE patient_id = $1",
        [patientIdNum]
      ),
    ]);

    const total = Number(countResult.rows[0].count);

    return NextResponse.json({
      measurements: dataResult.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof Response) {
      return NextResponse.json(
        JSON.parse(await error.text()),
        { status: error.status }
      );
    }
    console.error("Measurements fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
