import pool from "./db";

/**
 * Batch function: checks all active medications and creates refill alerts
 * for any that are running low (within 2 days of running out) and don't
 * already have a pending alert.
 */
export async function checkAndCreateRefillAlerts(): Promise<{
  created: number;
  checked: number;
}> {
  const { rows: medications } = await pool.query(
    "SELECT * FROM medications WHERE active = TRUE"
  );

  let created = 0;

  for (const med of medications) {
    const daysSupply = Math.floor(med.quantity / med.daily_doses);
    const refillDate = new Date(med.start_date);
    refillDate.setDate(refillDate.getDate() + daysSupply - 2);
    const refillDateStr = refillDate.toISOString().split("T")[0];

    // Check if unacknowledged refill alert already exists for this medication
    const { rows: existing } = await pool.query(
      `SELECT id FROM alerts
       WHERE medication_id = $1 AND type = 'refill_reminder' AND acknowledged = FALSE`,
      [med.id]
    );

    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO alerts (patient_id, medication_id, type, message, alert_date)
         VALUES ($1, $2, 'refill_reminder', $3, $4)`,
        [
          med.patient_id,
          med.id,
          `Time to refill ${med.name} (${med.dosage}). Estimated to run out in 2 days.`,
          refillDateStr,
        ]
      );
      created++;
    }
  }

  return { created, checked: medications.length };
}
