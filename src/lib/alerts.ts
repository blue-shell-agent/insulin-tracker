import pool from "./db";

interface MeasurementData {
  id: number;
  patient_id: number;
  type: string;
  value?: number;
  systolic?: number;
  diastolic?: number;
}

export async function checkAndCreateAlert(measurement: MeasurementData): Promise<void> {
  if (measurement.type === "glucemia") {
    await checkRange(measurement, null, measurement.value!);
  } else if (measurement.type === "blood_pressure") {
    await checkRange(measurement, "systolic", measurement.systolic!);
    await checkRange(measurement, "diastolic", measurement.diastolic!);
  }
}

async function checkRange(
  measurement: MeasurementData,
  subType: string | null,
  value: number
): Promise<void> {
  const { rows } = await pool.query(
    `SELECT min_value, max_value, unit FROM measurement_reference_ranges
     WHERE type = $1 AND sub_type IS NOT DISTINCT FROM $2`,
    [measurement.type, subType]
  );

  if (rows.length === 0) return;

  const range = rows[0];
  const label = subType ? `${measurement.type} (${subType})` : measurement.type;

  let message: string | null = null;
  let severity = "warning";

  if (value < range.min_value) {
    message = `${label} value ${value} ${range.unit} is below minimum (${range.min_value} ${range.unit})`;
    severity = value < range.min_value * 0.8 ? "critical" : "warning";
  } else if (value > range.max_value) {
    message = `${label} value ${value} ${range.unit} is above maximum (${range.max_value} ${range.unit})`;
    severity = value > range.max_value * 1.2 ? "critical" : "warning";
  }

  if (message) {
    await pool.query(
      `INSERT INTO alerts (measurement_id, patient_id, type, message, severity)
       VALUES ($1, $2, $3, $4, $5)`,
      [measurement.id, measurement.patient_id, measurement.type, message, severity]
    );
  }
}
