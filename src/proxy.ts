import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/server/adapters/auth-authjs";

/**
 * Route protection for /owner and /client. This is defense layer 1 of the
 * 5 named in docs/permissions.md §5 — page/layout code adds layer 3, and
 * every data access underneath is independently scoped regardless (layer
 * 1, the service layer, is the actual source of truth). Next.js 16 runs
 * `proxy` on the Node.js runtime unconditionally (no Edge option), which
 * is what lets `auth()` here run our Postgres-backed token-version check
 * (ADR 0003) instead of trusting the JWT's signature alone.
 */
const PUBLIC_PATH_PREFIXES = ["/login", "/forgot-password", "/api/auth"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = await auth();
  const role = session?.user?.role;

  if (!role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/owner") && role !== "OWNER") {
    return NextResponse.redirect(new URL("/client", request.url));
  }

  if (pathname.startsWith("/client") && role !== "CLIENT") {
    return NextResponse.redirect(new URL("/owner", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
