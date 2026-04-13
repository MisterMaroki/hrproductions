import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

function getAdminSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

function getClientSecret() {
  const secret = process.env.CLIENT_JWT_SECRET;
  if (!secret) throw new Error("CLIENT_JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

const PUBLIC_PORTAL_PATHS = [
  "/portal/login",
  "/portal/signup",
  "/api/portal/login",
  "/api/portal/signup",
  "/api/portal/logout",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin auth (existing) ──
  if (pathname === "/admin/login") return NextResponse.next();
  if (pathname === "/api/admin/login") return NextResponse.next();
  if (pathname === "/api/admin/logout") return NextResponse.next();

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (isAdminPage || isAdminApi) {
    const token = request.cookies.get("admin_session")?.value;
    if (!token) {
      if (isAdminApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    try {
      await jwtVerify(token, getAdminSecret());
      return NextResponse.next();
    } catch {
      if (isAdminApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // ── Portal auth ──
  const brandModeEnv = process.env.NEXT_PUBLIC_BRAND_MODE || process.env.BRAND_MODE;
  const isWhitelabelEnv = brandModeEnv === "whitelabel";

  const publicPaths = isWhitelabelEnv
    ? ["/portal/login", "/api/portal/login", "/api/portal/logout"]
    : PUBLIC_PORTAL_PATHS;

  if (publicPaths.includes(pathname)) return NextResponse.next();

  const isPortalPage = pathname.startsWith("/portal");
  const isPortalApi = pathname.startsWith("/api/portal");

  if (isPortalPage || isPortalApi) {
    if (isWhitelabelEnv) {
      const token = request.cookies.get("whitelabel_session")?.value;
      if (!token) {
        if (isPortalApi) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.redirect(new URL("/portal/login", request.url));
      }
      try {
        const secret = process.env.WHITELABEL_JWT_SECRET;
        if (!secret) throw new Error("WHITELABEL_JWT_SECRET not set");
        await jwtVerify(token, new TextEncoder().encode(secret));
        return NextResponse.next();
      } catch {
        if (isPortalApi) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.redirect(new URL("/portal/login", request.url));
      }
    }

    // Main deployment — existing client_session behavior
    const token = request.cookies.get("client_session")?.value;
    if (!token) {
      if (isPortalApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
    try {
      await jwtVerify(token, getClientSecret());
      return NextResponse.next();
    } catch {
      if (isPortalApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/portal/:path*", "/api/portal/:path*"],
};
