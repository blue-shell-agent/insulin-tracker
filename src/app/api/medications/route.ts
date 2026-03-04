import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth(request);
    } catch (res) {
      if (res instanceof Response) return res;
      throw res;
    }

    const body = await request.json();
    const { name, dosage, frequency, daily_doses, quantity, start_date } = body;

    if (!name || !dosage || !frequency || !daily_doses || !quantity) {
      return NextResponse.json(
        { error: "Missing required fields: name, dosage, frequency, daily_doses, quantity" },
        { status: 400 }
      );
    }

    const startDate = start_date || new Date().toISOString().split("T")[0];

    // Insert medication
    const { rows: medRows } = await pool.query(
      `INSERT INTO medications (patient_id, name, dosage, frequency, daily_doses, quantity, start_date, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING *`,
      [user.id, name, dosage, frequency, daily_doses, quantity, startDate]
    );

    const medication = medRows[0];

    // Calculate refill alert date: start_date + (quantity / daily_doses) - 2 days
    const daysSupply = Math.floor(quantity / daily_doses);
    const refillDate = new Date(startDate);
    refillDate.setDate(refillDate.getDate() + daysSupply - 2);

    // Insert refill reminder alert
    await pool.query(
      `INSERT INTO alerts (patient_id, medication_id, type, message, alert_date)
       VALUES ($1, $2, 'refill_reminder', $3, $4)`,
      [
        user.id,
        medication.id,
        `Time to refill ${name} (${dosage}). Estimated to run out in 2 days.`,
        refillDate.toISOString().split("T")[0],
      ]
    );

    return NextResponse.json({ medication }, { status: 201 });
  } catch (error) {
    console.error("Create medication error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
