import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import { checkAndCreateAlert } from "@/lib/alerts";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { type, value, systolic, diastolic, notes, measured_at, patient_id } = body;

    // Allow doctors to submit for a patient, otherwise use own id
    const targetPatientId = user.role === "doctor" && patient_id ? patient_id : user.id;

    if (!type || !["glucemia", "blood_pressure"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be 'glucemia' or 'blood_pressure'" },
        { status: 400 }
      );
    }

    if (type === "glucemia") {
      if (value == null || typeof value !== "number") {
        return NextResponse.json(
          { error: "Glucemia requires a numeric 'value' field" },
          { status: 400 }
        );
      }
    }

    if (type === "blood_pressure") {
      if (systolic == null || diastolic == null || typeof systolic !== "number" || typeof diastolic !== "number") {
        return NextResponse.json(
          { error: "Blood pressure requires numeric 'systolic' and 'diastolic' fields" },
          { status: 400 }
        );
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO measurements (patient_id, type, value, systolic, diastolic, notes, measured_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        targetPatientId,
        type,
        type === "glucemia" ? value : null,
        type === "blood_pressure" ? systolic : null,
        type === "blood_pressure" ? diastolic : null,
        notes || null,
        measured_at || new Date().toISOString(),
      ]
    );

    const measurement = rows[0];

    // Check for alerts asynchronously
    await checkAndCreateAlert({
      id: measurement.id,
      patient_id: targetPatientId,
      type,
      value,
      systolic,
      diastolic,
    });

    return NextResponse.json(measurement, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("POST /api/measurements error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
