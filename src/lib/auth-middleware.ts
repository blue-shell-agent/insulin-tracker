import { cookies } from "next/headers";
import { verifyToken } from "./auth";
import pool from "./db";

export interface AuthUser {
  id: number;
  email: string;
  role: string;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    const payload = await verifyToken(token);
    const { rows } = await pool.query("SELECT id, email, role FROM users WHERE id = $1", [payload.sub]);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
