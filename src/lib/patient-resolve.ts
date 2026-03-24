import pool from "./db";

/**
 * Resolve a user ID to the corresponding patients.id
 * Returns null if no patient record exists
 */
export async function resolvePatientId(userId: number): Promise<number | null> {
  const { rows } = await pool.query(
    "SELECT id FROM patients WHERE user_id = $1",
    [userId]
  );
  return rows.length > 0 ? rows[0].id : null;
}
