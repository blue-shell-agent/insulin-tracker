import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { token, platform } = await request.json();

    if (!token || !platform) {
      return NextResponse.json(
        { error: "token and platform are required" },
        { status: 400 }
      );
    }

    if (!["ios", "android", "web"].includes(platform)) {
      return NextResponse.json(
        { error: "platform must be ios, android, or web" },
        { status: 400 }
      );
    }

    try {
      await pool.query(
        `INSERT INTO device_tokens (user_id, token, platform)
         VALUES ($1, $2, $3)
         ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3`,
        [user.id, token, platform]
      );
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      if (err.message?.includes("does not exist")) {
        return NextResponse.json(
          { error: "Device tokens table not initialized" },
          { status: 503 }
        );
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    try {
      await pool.query(
        `DELETE FROM device_tokens WHERE user_id = $1 AND token = $2`,
        [user.id, token]
      );
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      if (err.message?.includes("does not exist")) {
        return NextResponse.json({ ok: true });
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
