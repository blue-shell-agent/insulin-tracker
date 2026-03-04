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

    if (daily_doses <= 0 || quantity <= 0 || !Number.isInteger(daily_doses) || !Number.isInteger(quantity)) {
      return NextResponse.json(
        { error: "daily_doses and quantity must be positive integers" },
        { status: 400 }
      );
    }

    const startDate = start_date || new Date().toISOString().split("T")[0];

    // Calculate refill alert date: start_date + (quantity / daily_doses) - 2 days
    const daysSupply = Math.floor(quantity / daily_doses);
    const refillDate = new Date(startDate);
    refillDate.setDate(refillDate.getDate() + daysSupply - 2);

    // Use transaction to ensure both medication and alert are created atomically
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: medRows } = await client.query(
        `INSERT INTO medications (patient_id, name, dosage, frequency, daily_doses, quantity, start_date, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
         RETURNING *`,
        [user.id, name, dosage, frequency, daily_doses, quantity, startDate]
      );

      const medication = medRows[0];

      await client.query(
        `INSERT INTO alerts (patient_id, medication_id, type, message, severity, alert_date)
         VALUES ($1, $2, 'refill_reminder', $3, 'warning', $4)`,
        [
          user.id,
          medication.id,
          `Time to refill ${name} (${dosage}). Estimated to run out in 2 days.`,
          refillDate.toISOString().split("T")[0],
        ]
      );

      await client.query("COMMIT");

      return NextResponse.json({ medication }, { status: 201 });
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Create medication error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
