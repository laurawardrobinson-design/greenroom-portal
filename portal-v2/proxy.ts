import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { user, response } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/"];
  const isPublicRoute = publicRoutes.includes(pathname);

  // Protect all non-public routes - redirect to login if not authenticated
  if (!isPublicRoute && !pathname.startsWith("/api") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from login to dashboard
  if (pathname === "/login" && user) {
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|json|webmanifest)$).*)",
  ],
};
