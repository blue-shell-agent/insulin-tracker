import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json({ user });
}
