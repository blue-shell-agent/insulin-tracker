import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { hashPassword } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { rows } = await pool.query("SELECT id, email, role, created_at FROM users ORDER BY created_at DESC");
  return NextResponse.json({ users: rows });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { email, password, role } = await request.json();
  if (!email || !password || !role) return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
  if (!["patient", "doctor", "admin"].includes(role)) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
  if (existing.rows.length > 0) return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });

  const password_hash = await hashPassword(password);
  const { rows } = await pool.query(
    "INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, created_at",
    [email.toLowerCase(), password_hash, role, email.split("@")[0], ""]
  );
  return NextResponse.json({ user: rows[0] }, { status: 201 });
}
