import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit } from "@/lib/rate-limit";

export async function proxy(request: NextRequest) {
  const { user, response } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // Rate-limit API routes before any further processing
  if (pathname.startsWith("/api")) {
    const blocked = checkRateLimit(request, response);
    if (blocked) return blocked;
  }

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/", "/laurai", "/rbu"];
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
