import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import pool from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!rateLimit(`register:${ip}`, 3, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Demasiados intentos. Intente más tarde." }, { status: 429 });
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { email, password } = parsed.data;

    // Check if email already exists
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 409 }
      );
    }

    const password_hash = await hashPassword(password);

    const { rows } = await pool.query(
      "INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role",
      [email.toLowerCase(), password_hash, "patient", email.split("@")[0], ""]
    );

    return NextResponse.json({ user: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}
