import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import pool from "@/lib/db";

export async function GET() {
  const user = await getAuthUser();
  if (!user || (user.role !== "doctor" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Get doctor record
  const { rows: doctorRows } = await pool.query(
    "SELECT id FROM doctors WHERE user_id = $1",
    [user.id]
  );

  if (doctorRows.length === 0) {
    return NextResponse.json({ patients: [] });
  }

  const doctorId = doctorRows[0].id;

  // Get assigned patients with latest vitals
  const { rows: patients } = await pool.query(`
    SELECT 
      p.id as patient_id,
      u.id as user_id,
      u.email,
      u.first_name,
      u.last_name,
      p.date_of_birth,
      p.gender,
      pd.status as assignment_status,
      pd.assigned_at,
      (SELECT json_build_object('value', m.value, 'recorded_at', m.recorded_at)
       FROM measurements m WHERE m.patient_id = p.id AND m.type = 'glucemia'
       ORDER BY m.recorded_at DESC LIMIT 1) as latest_glucose,
      (SELECT json_build_object('value', m.value, 'notes', m.notes, 'recorded_at', m.recorded_at)
       FROM measurements m WHERE m.patient_id = p.id AND m.type = 'blood_pressure'
       ORDER BY m.recorded_at DESC LIMIT 1) as latest_bp,
      (SELECT json_build_object('value', m.value, 'recorded_at', m.recorded_at)
       FROM measurements m WHERE m.patient_id = p.id AND m.type = 'weight'
       ORDER BY m.recorded_at DESC LIMIT 1) as latest_weight,
      (SELECT COUNT(*) FROM alerts a WHERE a.patient_id = p.id AND a.read = false) as unread_alerts
    FROM patient_doctor pd
    JOIN patients p ON p.id = pd.patient_id
    JOIN users u ON u.id = p.user_id
    WHERE pd.doctor_id = $1 AND pd.status = 'active'
    ORDER BY u.last_name, u.email
  `, [doctorId]);

  return NextResponse.json({ patients });
}
