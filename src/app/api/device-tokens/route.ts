import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";

const TOKEN_MAX_LENGTH = 512;
const TOKEN_MIN_LENGTH = 16;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { token, platform } = await request.json();

    if (!token || !platform) {
      return NextResponse.json({ error: "Token y plataforma requeridos" }, { status: 400 });
    }

    if (typeof token !== "string" || token.length < TOKEN_MIN_LENGTH || token.length > TOKEN_MAX_LENGTH) {
      return NextResponse.json(
        { error: `El token debe tener entre ${TOKEN_MIN_LENGTH} y ${TOKEN_MAX_LENGTH} caracteres` },
        { status: 400 }
      );
    }

    if (!["ios", "android", "web"].includes(platform)) {
      return NextResponse.json({ error: "Plataforma debe ser ios, android o web" }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO device_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3, updated_at = NOW()`,
      [user.id, token, platform]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Device token POST error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    await pool.query(
      `DELETE FROM device_tokens WHERE user_id = $1 AND token = $2`,
      [user.id, token]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Device token DELETE error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
