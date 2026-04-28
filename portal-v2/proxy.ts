import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit } from "@/lib/rate-limit";

const SITE_GATE_COOKIE = "site_unlocked";

async function expectedGateDigest(password: string): Promise<string> {
  const buf = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Site-wide gate. Runs before anything else so bots can't even hit the
  // login page, rate limiter, or Supabase. Cookie value is sha256(password)
  // so rotating SITE_PASSWORD invalidates every issued cookie.
  const gatePassword = process.env.SITE_PASSWORD;
  const gateDisabled = process.env.SITE_GATE_DISABLED === "true";
  if (gatePassword && !gateDisabled) {
    const isUnlockPath =
      pathname === "/unlock" || pathname === "/api/site-gate";
    if (!isUnlockPath) {
      const cookie = request.cookies.get(SITE_GATE_COOKIE)?.value;
      const expected = await expectedGateDigest(gatePassword);
      if (cookie !== expected) {
        const url = request.nextUrl.clone();
        url.pathname = "/unlock";
        const next = pathname + request.nextUrl.search;
        url.search =
          next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
        return NextResponse.redirect(url);
      }
    }
  }

  const { user, response } = await updateSession(request);

  // Rate-limit API routes before any further processing
  if (pathname.startsWith("/api")) {
    const blocked = checkRateLimit(request, response);
    if (blocked) return blocked;
  }

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/", "/laurai", "/rbu", "/unlock"];
  const publicPrefixes = ["/pr/"]; // tokenized PR views + dept calendars
  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    publicPrefixes.some((p) => pathname.startsWith(p));

  // Protect all non-public routes - redirect to login if not authenticated
  if (!isPublicRoute && !pathname.startsWith("/api") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from login to dashboard,
  // unless they navigated to /login intentionally from a public page
  // (e.g. to pick an RBU department).
  const referer = request.headers.get("referer") || "";
  const cameFromPublic =
    referer.includes("/rbu") || referer.includes("/pr/");
  if (pathname === "/login" && user && !cameFromPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - Static assets (images, fonts, manifests, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|json|webmanifest|pdf|mp4|mp3|webm|mov)$).*)",
  ],
};
