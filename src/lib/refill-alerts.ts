import pool from "./db";

/**
 * Batch function: checks all active prescriptions and creates alerts
 * for any that are expiring within 7 days and don't already have a pending alert.
 */
export async function checkAndCreateRefillAlerts(): Promise<{
  created: number;
  checked: number;
}> {
  const { rows: countRows } = await pool.query(
    "SELECT COUNT(*)::int AS total FROM prescriptions WHERE status = 'active'"
  );
  const checked = countRows[0].total;

  const { rowCount } = await pool.query(
    `INSERT INTO alerts (patient_id, type, severity, title, message)
     SELECT
       p.patient_id,
       'medication_expiring',
       'warning',
       'Receta por vencer',
       'La receta de ' || pi.medication_name || ' (' || pi.dosage || ') vence pronto.'
     FROM prescriptions p
     JOIN prescription_items pi ON pi.prescription_id = p.id
     WHERE p.status = 'active'
       AND p.expires_at IS NOT NULL
       AND p.expires_at <= NOW() + INTERVAL '7 days'
       AND NOT EXISTS (
         SELECT 1 FROM alerts a
         WHERE a.patient_id = p.patient_id
           AND a.type = 'medication_expiring'
           AND a.read = FALSE
       )`
  );

  return { created: rowCount ?? 0, checked };
}
