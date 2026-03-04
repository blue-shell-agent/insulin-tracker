import pool from "./db";

export interface ReferenceRange {
  id: number;
  measurement_type: string;
  unit: string;
  range_min: number;
  range_max: number;
}

export interface AlertInfo {
  alert_type: string;
  severity: string;
  message: string;
}

export async function getReferenceRange(
  measurementType: string,
  unit: string
): Promise<ReferenceRange | null> {
  const { rows } = await pool.query(
    "SELECT * FROM measurement_reference_ranges WHERE measurement_type = $1 AND unit = $2",
    [measurementType, unit]
  );
  return rows[0] ?? null;
}

export function checkReferenceRange(
  value: number,
  range: ReferenceRange
): AlertInfo | null {
  if (value <= 54) {
    return {
      alert_type: "hypo",
      severity: "critical",
      message: `Critical hypoglycemia: ${value} ${range.unit} (≤54). Immediate action required.`,
    };
  }
  if (value <= 69) {
    return {
      alert_type: "hypo",
      severity: "warning",
      message: `Hypoglycemia warning: ${value} ${range.unit} (below ${range.range_min}).`,
    };
  }
  if (value >= 200) {
    return {
      alert_type: "hyper",
      severity: "critical",
      message: `Critical hyperglycemia: ${value} ${range.unit} (≥200). Immediate action required.`,
    };
  }
  if (value >= 101) {
    return {
      alert_type: "hyper",
      severity: "warning",
      message: `Hyperglycemia warning: ${value} ${range.unit} (above ${range.range_max}).`,
    };
  }
  return null;
}

export async function createAlert(
  measurementId: number,
  patientId: number,
  alert: AlertInfo
) {
  const { rows } = await pool.query(
    `INSERT INTO alerts (measurement_id, patient_id, alert_type, severity, message)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [measurementId, patientId, alert.alert_type, alert.severity, alert.message]
  );
  return rows[0];
}
