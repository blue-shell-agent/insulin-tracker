"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface User { id: number; email: string; role: string }
interface Measurement { id: number; type: string; value: number; unit: string; notes: string; recorded_at: string }
interface Alert { id: number; title: string; message: string; severity: string }
interface Medication { id: number; name: string; dosage: string; frequency: string; instructions: string }

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [glucemia, setGlucemia] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const loadData = useCallback(async () => {
    try {
      const userRes = await fetch("/nivelo/api/auth/me", { credentials: "include" });
      if (!userRes.ok) { router.push("/login"); return; }
      const userData = await userRes.json();
      setUser(userData.user);

      // Load other data independently — don't redirect on failure
      const [measRes, alertRes, medRes] = await Promise.all([
        fetch("/nivelo/api/measurements", { credentials: "include" }).catch(() => null),
        fetch("/nivelo/api/alerts", { credentials: "include" }).catch(() => null),
        fetch("/nivelo/api/medications", { credentials: "include" }).catch(() => null),
      ]);

      if (measRes?.ok) {
        const d = await measRes.json().catch(() => ({}));
        setMeasurements(d.measurements || []);
      }
      if (alertRes?.ok) {
        const d = await alertRes.json().catch(() => ({}));
        setAlerts(d.alerts || []);
      }
      if (medRes?.ok) {
        const d = await medRes.json().catch(() => ({}));
        setMedications(d.medications || []);
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  async function logMeasurement(type: string) {
    setLoading(true); setMsg("");
    const body = type === "glucemia"
      ? { type, value: Number(glucemia) }
      : { type: "blood_pressure", systolic: Number(systolic), diastolic: Number(diastolic) };

    try {
      const res = await fetch("/nivelo/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
      if (res.ok) { setMsg("✓ Registrado"); setGlucemia(""); setSystolic(""); setDiastolic(""); loadData(); }
      else { const d = await res.json(); setMsg(d.error || "Error"); }
    } catch { setMsg("Error de conexión"); }
    finally { setLoading(false); }
  }

  async function logout() {
    await fetch("/nivelo/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  }

  // Helper to extract diastolic from notes
  function getDiastolic(m: Measurement): string {
    const match = m.notes?.match(/diastolic:(\d+)/);
    return match ? match[1] : "?";
  }

  const glucemiaData = measurements
    .filter(m => m.type === "glucemia" && m.value)
    .reverse()
    .map(m => ({ date: new Date(m.recorded_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }), valor: m.value }));

  if (!user) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <div>
              <h1 className="font-bold text-gray-800">Nivelo</h1>
              <p className="text-xs text-gray-500">Hola, {user.email.split("@")[0]}</p>
            </div>
          </div>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Cerrar sesión</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map(a => (
              <div key={a.id} className={`p-4 rounded-xl text-sm font-medium ${a.severity === "critical" ? "bg-red-50 text-red-700 border border-red-200" : "bg-yellow-50 text-yellow-700 border border-yellow-200"}`}>
                ⚠️ {a.title}{a.message ? `: ${a.message}` : ""}
              </div>
            ))}
          </div>
        )}

        {/* Quick Log */}
        {msg && <div className="bg-primary-50 text-primary-700 p-3 rounded-xl text-sm text-center">{msg}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-3">🩸 Glucemia</h3>
            <div className="flex gap-2">
              <input type="number" value={glucemia} onChange={e => setGlucemia(e.target.value)} placeholder="mg/dL"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
              <button onClick={() => logMeasurement("glucemia")} disabled={!glucemia || loading}
                className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 transition">Registrar</button>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-3">💓 Presión Arterial</h3>
            <div className="flex gap-2">
              <input type="number" value={systolic} onChange={e => setSystolic(e.target.value)} placeholder="Sist."
                className="w-20 px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
              <span className="self-center text-gray-400">/</span>
              <input type="number" value={diastolic} onChange={e => setDiastolic(e.target.value)} placeholder="Diast."
                className="w-20 px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
              <button onClick={() => logMeasurement("blood_pressure")} disabled={!systolic || !diastolic || loading}
                className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 transition">Registrar</button>
            </div>
          </div>
        </div>

        {/* Chart */}
        {glucemiaData.length > 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">📈 Glucemia en el tiempo</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={glucemiaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="valor" stroke="#16a34a" strokeWidth={2} dot={{ r: 4, fill: "#16a34a" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent Measurements */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">📋 Mediciones Recientes</h3>
          {measurements.length === 0 ? <p className="text-gray-400 text-sm">Sin mediciones aún</p> : (
            <div className="space-y-3">
              {measurements.slice(0, 10).map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{m.type === "glucemia" ? "🩸" : m.type === "blood_pressure" ? "💓" : "📏"}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {m.type === "glucemia" ? `${m.value} mg/dL` :
                         m.type === "blood_pressure" ? `${m.value}/${getDiastolic(m)} mmHg` :
                         `${m.value} ${m.unit}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {m.type === "glucemia" ? "Glucemia" : m.type === "blood_pressure" ? "Presión Arterial" : m.type}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(m.recorded_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Medications */}
        {medications.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">💊 Medicamentos Activos</h3>
            <div className="space-y-3">
              {medications.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{m.name}</p>
                    <p className="text-xs text-gray-400">{m.dosage}{m.frequency ? ` — ${m.frequency}` : ""}</p>
                    {m.instructions && <p className="text-xs text-gray-400 italic">{m.instructions}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
