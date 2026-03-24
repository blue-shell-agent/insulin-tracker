import { NextRequest, NextResponse } from "next/server";
import { comparePassword, signToken } from "@/lib/auth";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });

    const { rows } = await pool.query("SELECT id, email, password_hash, role FROM users WHERE email = $1", [email.toLowerCase()]);
    if (rows.length === 0) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

    const user = rows[0];
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

    const token = await signToken({ sub: user.id, email: user.email, role: user.role });

    const response = NextResponse.json({ user: { id: user.id, email: user.email, role: user.role } });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/nivelo",
    });
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
