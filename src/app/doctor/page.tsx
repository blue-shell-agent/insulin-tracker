"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Patient {
  patient_id: number;
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  assignment_status: string;
  assigned_at: string;
  latest_glucose: { value: number; recorded_at: string } | null;
  latest_bp: { value: number; notes: string; recorded_at: string } | null;
  latest_weight: { value: number; recorded_at: string } | null;
  unread_alerts: string;
}

type VitalStatus = "normal" | "warning" | "critical";

function getGlucoseStatus(v: number): VitalStatus {
  if (v < 54 || v > 200) return "critical";
  if (v < 70 || v > 140) return "warning";
  return "normal";
}

function getBPStatus(systolic: number): VitalStatus {
  if (systolic > 140) return "critical";
  if (systolic >= 130) return "warning";
  return "normal";
}

const statusBadge: Record<VitalStatus, string> = {
  normal: "bg-green-100 text-green-700",
  warning: "bg-yellow-100 text-yellow-700",
  critical: "bg-red-100 text-red-700",
};

const statusDot: Record<VitalStatus, string> = {
  normal: "bg-green-500",
  warning: "bg-yellow-500",
  critical: "bg-red-500",
};

function parseDiastolic(notes: string | null): number | null {
  if (!notes) return null;
  const m = notes.match(/diastolic:(\d+)/);
  return m ? parseInt(m[1]) : null;
}

export default function DoctorDashboard() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/nivelo/api/doctor/patients", { credentials: "include" });
      if (!res.ok) { router.push("/login"); return; }
      const data = await res.json();
      setPatients(data.patients || []);
    } catch { router.push("/login"); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function logout() {
    await fetch("/nivelo/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  }

  function patientName(p: Patient) {
    if (p.first_name || p.last_name) return `${p.first_name || ""} ${p.last_name || ""}`.trim();
    return p.email.split("@")[0];
  }

  function worstStatus(p: Patient): VitalStatus {
    const statuses: VitalStatus[] = [];
    if (p.latest_glucose) statuses.push(getGlucoseStatus(p.latest_glucose.value));
    if (p.latest_bp) statuses.push(getBPStatus(p.latest_bp.value));
    if (statuses.includes("critical")) return "critical";
    if (statuses.includes("warning")) return "warning";
    return "normal";
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  // Sort: critical first, then warning, then normal
  const sorted = [...patients].sort((a, b) => {
    const order: Record<VitalStatus, number> = { critical: 0, warning: 1, normal: 2 };
    return order[worstStatus(a)] - order[worstStatus(b)];
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <div>
              <h1 className="font-bold text-gray-800">Nivelo</h1>
              <p className="text-xs text-gray-500">Panel del Doctor</p>
            </div>
          </div>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Cerrar sesión</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{patients.length}</p>
            <p className="text-xs text-gray-500">Pacientes</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{sorted.filter(p => worstStatus(p) === "critical").length}</p>
            <p className="text-xs text-gray-500">Críticos</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{sorted.filter(p => worstStatus(p) === "warning").length}</p>
            <p className="text-xs text-gray-500">Alerta</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{sorted.filter(p => worstStatus(p) === "normal").length}</p>
            <p className="text-xs text-gray-500">Normal</p>
          </div>
        </div>

        {/* Patient list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">👥 Mis Pacientes</h3>
          {sorted.length === 0 ? (
            <p className="text-gray-400 text-sm">No tiene pacientes asignados</p>
          ) : (
            <div className="space-y-3">
              {sorted.map(p => {
                const status = worstStatus(p);
                const diastolic = p.latest_bp ? parseDiastolic(p.latest_bp.notes) : null;
                return (
                  <div
                    key={p.patient_id}
                    onClick={() => router.push(`/doctor/patient/${p.patient_id}`)}
                    className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                          {patientName(p)[0].toUpperCase()}
                        </div>
                        <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusDot[status]}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{patientName(p)}</p>
                        <p className="text-xs text-gray-400">{p.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Glucose */}
                      {p.latest_glucose && (
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusBadge[getGlucoseStatus(p.latest_glucose.value)]}`}>
                          🩸 {p.latest_glucose.value} mg/dL
                        </span>
                      )}
                      {/* BP */}
                      {p.latest_bp && (
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusBadge[getBPStatus(p.latest_bp.value)]}`}>
                          💓 {p.latest_bp.value}/{diastolic ?? "?"} mmHg
                        </span>
                      )}
                      {/* Weight */}
                      {p.latest_weight && (
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700">
                          ⚖️ {p.latest_weight.value} kg
                        </span>
                      )}
                      {/* Unread alerts */}
                      {Number(p.unread_alerts) > 0 && (
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700">
                          ⚠️ {p.unread_alerts}
                        </span>
                      )}
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
