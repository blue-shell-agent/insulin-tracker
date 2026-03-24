export const THRESHOLDS = {
  glucemia: {
    criticalLow: 54,
    warningLow: 70,
    warningHigh: 140,
    criticalHigh: 200,
    unit: "mg/dL",
  },
  systolic: {
    normal: 130,
    warning: 140,
    unit: "mmHg",
  },
  diastolic: {
    normal: 80,
    warning: 90,
    unit: "mmHg",
  },
};

export type VitalStatus = "normal" | "warning" | "critical";

export function getGlucemiaStatus(value: number): VitalStatus {
  if (value < THRESHOLDS.glucemia.criticalLow || value > THRESHOLDS.glucemia.criticalHigh) return "critical";
  if (value < THRESHOLDS.glucemia.warningLow || value > THRESHOLDS.glucemia.warningHigh) return "warning";
  return "normal";
}

export function getSystolicStatus(value: number): VitalStatus {
  if (value > THRESHOLDS.systolic.warning) return "critical";
  if (value >= THRESHOLDS.systolic.normal) return "warning";
  return "normal";
}

export function getDiastolicStatus(value: number): VitalStatus {
  if (value > THRESHOLDS.diastolic.warning) return "critical";
  if (value >= THRESHOLDS.diastolic.normal) return "warning";
  return "normal";
}

export function getBloodPressureStatus(systolic: number, diastolic: number): VitalStatus {
  const s = getSystolicStatus(systolic);
  const d = getDiastolicStatus(diastolic);
  if (s === "critical" || d === "critical") return "critical";
  if (s === "warning" || d === "warning") return "warning";
  return "normal";
}

export const statusColors: Record<VitalStatus, { bg: string; text: string; dot: string }> = {
  normal: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  warning: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  critical: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};
