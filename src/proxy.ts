import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/requerimientos", "/usuarios", "/reportes"];
const AUTH_PATHS = ["/auth/login", "/auth/recuperar-contrasena"];

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return false;

  try {
    const response = await fetch(new URL("/api/auth/session", request.url), {
      method: "GET",
      headers: {
        cookie: cookieHeader,
        "x-proxy-auth-check": "1",
      },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("session")?.value;

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  const isAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));

  if (isProtected && !sessionCookie) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (sessionCookie && (isProtected || isAuthPath)) {
    const isValid = await hasValidSession(request);
    if (!isValid) {
      if (isProtected) {
        const loginUrl = new URL("/auth/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete("session");
        return response;
      }

      const response = NextResponse.next();
      response.cookies.delete("session");
      return response;
    }
  }

  if (isAuthPath && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/requerimientos/:path*",
    "/usuarios/:path*",
    "/reportes/:path*",
    "/auth/:path*",
  ],
};
