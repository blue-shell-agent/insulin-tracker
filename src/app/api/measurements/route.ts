import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import pool from "@/lib/db";
import {
  getReferenceRange,
  checkReferenceRange,
  createAlert,
} from "@/lib/measurements";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { measurement_type, value, unit, notes, recorded_at } = body;

    if (!measurement_type || value == null || !unit) {
      return NextResponse.json(
        { error: "measurement_type, value, and unit are required" },
        { status: 400 }
      );
    }

    const numericValue = Number(value);
    if (isNaN(numericValue)) {
      return NextResponse.json(
        { error: "value must be a number" },
        { status: 400 }
      );
    }

    const { rows } = await pool.query(
      `INSERT INTO measurements (patient_id, measurement_type, value, unit, notes, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        user.id,
        measurement_type,
        numericValue,
        unit,
        notes ?? null,
        recorded_at ?? new Date().toISOString(),
      ]
    );

    const measurement = rows[0];
    let alert = null;

    const range = await getReferenceRange(measurement_type, unit);
    if (range) {
      const alertInfo = checkReferenceRange(numericValue, range);
      if (alertInfo) {
        alert = await createAlert(measurement.id, user.id, alertInfo);
      }
    }

    return NextResponse.json({ measurement, alert }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) {
      return NextResponse.json(
        JSON.parse(await error.text()),
        { status: error.status }
      );
    }
    console.error("Measurement creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
