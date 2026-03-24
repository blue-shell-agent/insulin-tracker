import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET || "");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/login") || pathname.startsWith("/_next") || pathname.startsWith("/sw.js") || pathname.startsWith("/manifest") || pathname.startsWith("/favicon") || pathname.startsWith("/icon")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());

    // Redirect users to their role-specific dashboard
    if (pathname === "/dashboard" || pathname === "/") {
      if (payload.role === "doctor") {
        const url = request.nextUrl.clone();
        url.pathname = "/doctor";
        return NextResponse.redirect(url);
      }
      if (payload.role === "admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }
    }

    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
      if (payload.role !== "admin") {
        if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        const url = request.nextUrl.clone();
        url.pathname = payload.role === "doctor" ? "/doctor" : "/dashboard";
        return NextResponse.redirect(url);
      }
    }

    if (pathname.startsWith("/doctor") || pathname.startsWith("/api/doctor")) {
      if (payload.role !== "doctor" && payload.role !== "admin") {
        if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    response.cookies.set("token", "", { maxAge: 0, path: "/" });
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
