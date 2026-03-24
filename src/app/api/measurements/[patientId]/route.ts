import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";

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

    // Patients can only see their own data
    if (user.role !== "doctor" && user.id !== pid) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const type = url.searchParams.get("type");
    const offset = (page - 1) * limit;

    let query = "SELECT * FROM measurements WHERE patient_id = $1";
    let countQuery = "SELECT COUNT(*) FROM measurements WHERE patient_id = $1";
    const queryParams: (number | string)[] = [pid];
    const countParams: (number | string)[] = [pid];

    if (type && ["glucemia", "blood_pressure"].includes(type)) {
      query += ` AND type = $2`;
      countQuery += ` AND type = $2`;
      queryParams.push(type);
      countParams.push(type);
    }

    query += ` ORDER BY recorded_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return NextResponse.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("GET /api/measurements/[patientId] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
