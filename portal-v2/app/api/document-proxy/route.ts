import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host === "127.0.0.1" || host === "::1") return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true; // link-local / cloud metadata (AWS IMDS, GCP, Azure)
  if (host === "0.0.0.0") return true;
  return false;
}

function isAllowedRemoteHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host.endsWith(".supabase.co")) return true;

  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (configured) {
    try {
      const configuredHost = new URL(configured).hostname.toLowerCase();
      if (host === configuredHost) return true;
    } catch {
      // Ignore invalid env format.
    }
  }

  return false;
}

export async function GET(request: Request) {
  try {
    await getAuthUser();
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get("url");
    if (!rawUrl) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }

    if (target.protocol !== "https:") {
      return NextResponse.json({ error: "Only https URLs are allowed" }, { status: 400 });
    }

    if (isPrivateHostname(target.hostname)) {
      return NextResponse.json({ error: "Blocked host" }, { status: 403 });
    }

    if (!isAllowedRemoteHost(target.hostname)) {
      return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
    }

    const upstream = await fetch(target.toString(), { redirect: "follow" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Upstream failed (${upstream.status})` },
        { status: 502 }
      );
    }

    const headers = new Headers();
    headers.set("Cache-Control", "no-store");
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") || "application/octet-stream"
    );
    const contentDisposition = upstream.headers.get("content-disposition");
    if (contentDisposition) headers.set("Content-Disposition", contentDisposition);

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    return authErrorResponse(error);
  }
}
