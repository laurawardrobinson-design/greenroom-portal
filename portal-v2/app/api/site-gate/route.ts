import { NextResponse } from "next/server";
import { createHash } from "crypto";

// POST /api/site-gate — validates the site-wide password and sets the
// unlock cookie. The cookie value is the SHA-256 of the password; rotating
// SITE_PASSWORD invalidates every cookie automatically.
export async function POST(request: Request) {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) {
    // No password configured — gate is effectively off; tell the client so.
    return NextResponse.json({ ok: true, disabled: true });
  }

  let password = "";
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    // ignore — empty password fails the comparison below
  }

  if (password !== expected) {
    // Tiny artificial delay slows down trivial brute-force attempts.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const digest = createHash("sha256").update(expected).digest("hex");
  const res = NextResponse.json({ ok: true });
  res.cookies.set("site_unlocked", digest, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
