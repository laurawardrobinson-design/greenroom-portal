import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";

// ── HTML helpers ──────────────────────────────────────────────────────────────

function extractMeta(html: string, property: string): string | null {
  const metaTags = html.match(/<meta[^>]+>/gi) || [];
  for (const tag of metaTags) {
    const hasProperty = new RegExp(`(?:property|name)\\s*=\\s*["']${property}["']`, "i").test(tag);
    if (!hasProperty) continue;
    const m = tag.match(/content\s*=\s*["']([^"']*?)["']/i);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1]?.trim().replace(/\s+/g, " ") ?? null;
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripHtml(html: string): string {
  // Remove scripts, styles, nav, header, footer, aside
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "");

  // Replace block elements with newlines
  text = text
    .replace(/<\/?(h[1-6]|p|div|section|article|ul|ol|li|br|tr|td|th)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return decodeEntities(text);
}

// Extract the main content area — tries <main>, <article>, then <body>
function extractMainContent(html: string): string {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return stripHtml(mainMatch[1]);

  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return stripHtml(articleMatch[1]);

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return stripHtml(bodyMatch[1]);

  return stripHtml(html);
}

// Extract name from the last meaningful URL path segment
function nameFromUrlSlug(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last || last.length < 3) return null;
    // Convert kebab-case to Title Case
    return last.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  } catch {
    return null;
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    await getAuthUser();
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    try { new URL(url); } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Always try name from URL slug as a baseline
    const slugName = nameFromUrlSlug(url);

    let name: string | null = null;
    let description: string | null = null;
    let standards: string | null = null;
    let fetchFailed = false;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();

      const rawTitle =
        extractMeta(html, "og:title") ??
        extractMeta(html, "twitter:title") ??
        extractTitle(html);

      name = rawTitle ? decodeEntities(rawTitle) : null;
      // Clean up site name suffixes like " | Publix" or " - Publix Employee Connect"
      if (name) name = name.replace(/\s*[|–—-]\s*[^|–—-]+$/, "").trim();

      const rawDesc =
        extractMeta(html, "og:description") ??
        extractMeta(html, "twitter:description") ??
        extractMeta(html, "description");
      description = rawDesc ? decodeEntities(rawDesc) : null;

      // Extract body text as standards content (trim to ~2000 chars to avoid noise)
      const body = extractMainContent(html);
      if (body && body.length > 50) {
        standards = body.length > 2000 ? body.slice(0, 2000).replace(/\n[^\n]*$/, "") + "\n…" : body;
      }
    } catch {
      fetchFailed = true;
    }

    // Fall back to slug-derived name
    if (!name) name = slugName;

    if (!name && fetchFailed) {
      return NextResponse.json(
        { error: "Could not reach this page. It may require Publix network access — fill in manually." },
        { status: 422 }
      );
    }

    return NextResponse.json({ name, description, standards });
  } catch (error) {
    return authErrorResponse(error);
  }
}
