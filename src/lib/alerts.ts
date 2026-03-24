import pool from "./db";
import { THRESHOLDS, type VitalStatus } from "./thresholds";

interface MeasurementData {
  id: number;
  patient_id: number;
  type: string;
  value: number;
  notes?: string;
}

export interface AlertResult {
  status: VitalStatus;
  title: string;
  message: string;
}

export async function checkAndCreateAlert(measurement: MeasurementData): Promise<AlertResult | null> {
  try {
    let title = "";
    let message = "";
    let severity: VitalStatus = "warning";

    if (measurement.type === "glucemia") {
      const v = measurement.value;
      if (v < THRESHOLDS.glucemia.criticalLow || v > THRESHOLDS.glucemia.criticalHigh) {
        severity = "critical";
      }
      if (v < THRESHOLDS.glucemia.warningLow) {
        title = "Glucemia baja";
        message = `${v} ${THRESHOLDS.glucemia.unit} (mínimo: ${THRESHOLDS.glucemia.warningLow})`;
      } else if (v > THRESHOLDS.glucemia.warningHigh) {
        title = "Glucemia alta";
        message = `${v} ${THRESHOLDS.glucemia.unit} (máximo: ${THRESHOLDS.glucemia.warningHigh})`;
      }
    }

    if (measurement.type === "blood_pressure") {
      const systolic = measurement.value;
      const diastolicMatch = measurement.notes?.match(/diastolic:(\d+)/);
      const diastolic = diastolicMatch ? Number(diastolicMatch[1]) : 0;
      if (systolic > THRESHOLDS.systolic.warning || diastolic > THRESHOLDS.diastolic.warning) {
        title = "Presión arterial elevada";
        message = `${systolic}/${diastolic} ${THRESHOLDS.systolic.unit}`;
        severity = systolic > THRESHOLDS.systolic.warning ? "critical" : "warning";
      } else if (systolic >= THRESHOLDS.systolic.normal || diastolic >= THRESHOLDS.diastolic.normal) {
        title = "Presión arterial elevada";
        message = `${systolic}/${diastolic} ${THRESHOLDS.systolic.unit}`;
        severity = "warning";
      }
    }

    if (title) {
      await pool.query(
        `INSERT INTO alerts (patient_id, type, severity, title, message)
         VALUES ($1, 'measurement_critical', $2, $3, $4)`,
        [measurement.patient_id, severity, title, message]
      );
      return { status: severity, title, message };
    }

    return null;
  } catch (err) {
    console.error("Alert check error:", err);
    return null;
  }
}
