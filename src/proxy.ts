import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/requerimientos", "/usuarios", "/reportes"];
const AUTH_PATHS = ["/auth/login", "/auth/recuperar-contrasena"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("session")?.value;

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  const isAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));

  if (isProtected && !sessionCookie) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
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
