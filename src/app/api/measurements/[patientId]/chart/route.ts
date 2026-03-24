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

    if (user.role !== "doctor" && user.id !== pid) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "glucemia";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!["glucemia", "blood_pressure", "weight"].includes(type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    let query = `SELECT id, type, value, unit, notes, recorded_at
                 FROM measurements WHERE patient_id = $1 AND type = $2`;
    const queryParams: (number | string)[] = [pid, type];

    if (from) {
      queryParams.push(from);
      query += ` AND recorded_at >= $${queryParams.length}`;
    }
    if (to) {
      queryParams.push(to);
      query += ` AND recorded_at <= $${queryParams.length}`;
    }

    query += ` ORDER BY recorded_at ASC`;

    const [dataResult, rangesResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(
        `SELECT sub_type, min_value, max_value, unit
         FROM measurement_reference_ranges WHERE type = $1`,
        [type]
      ),
    ]);

    const referenceRanges: Record<string, { min: number; max: number; unit: string }> = {};
    for (const r of rangesResult.rows) {
      const key = r.sub_type || "value";
      referenceRanges[key] = { min: Number(r.min_value), max: Number(r.max_value), unit: r.unit };
    }

    return NextResponse.json({
      type,
      data: dataResult.rows,
      referenceRanges,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("GET /api/measurements/[patientId]/chart error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
