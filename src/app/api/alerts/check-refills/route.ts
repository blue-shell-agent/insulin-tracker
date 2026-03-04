import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { checkAndCreateRefillAlerts } from "@/lib/refill-alerts";

export async function POST(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth(request);
    } catch (res) {
      if (res instanceof Response) return res;
      throw res;
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await checkAndCreateRefillAlerts();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Check refills error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
