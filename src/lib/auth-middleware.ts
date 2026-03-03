import { NextRequest } from "next/server";
import { verifyToken } from "./auth";
import pool from "./db";

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  created_at: string;
}

export async function getAuthUser(
  request: NextRequest
): Promise<AuthUser | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7);
  try {
    const payload = await verifyToken(token);
    const { rows } = await pool.query(
      "SELECT id, email, role, created_at FROM users WHERE id = $1",
      [payload.sub]
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
