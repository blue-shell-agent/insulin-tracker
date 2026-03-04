import pool from "./db";

/**
 * Batch function: checks all active medications and creates refill alerts
 * for any that are running low (within 2 days of running out) and don't
 * already have a pending alert.
 *
 * Refill date is calculated dynamically from current date context:
 * start_date + (quantity / daily_doses) days = estimated depletion date.
 * Alert fires when depletion is <= 2 days away.
 *
 * Uses a single INSERT...SELECT to avoid N+1 queries.
 */
export async function checkAndCreateRefillAlerts(): Promise<{
  created: number;
  checked: number;
}> {
  // Count active medications for the response
  const { rows: countRows } = await pool.query(
    "SELECT COUNT(*)::int AS total FROM medications WHERE active = TRUE"
  );
  const checked = countRows[0].total;

  // Single query: find medications nearing depletion with no pending refill alert,
  // and insert alerts for them in one pass.
  const { rowCount } = await pool.query(
    `INSERT INTO alerts (patient_id, medication_id, type, message, severity, alert_date)
     SELECT
       m.patient_id,
       m.id,
       'refill_reminder',
       'Time to refill ' || m.name || ' (' || m.dosage || '). Estimated to run out in 2 days.',
       'warning',
       (m.start_date + (m.quantity / m.daily_doses) * INTERVAL '1 day')::date
     FROM medications m
     WHERE m.active = TRUE
       AND (m.start_date + (m.quantity / m.daily_doses) * INTERVAL '1 day') <= CURRENT_DATE + INTERVAL '2 days'
       AND NOT EXISTS (
         SELECT 1 FROM alerts a
         WHERE a.medication_id = m.id
           AND a.type = 'refill_reminder'
           AND a.acknowledged = FALSE
       )`
  );

  return { created: rowCount ?? 0, checked };
}
