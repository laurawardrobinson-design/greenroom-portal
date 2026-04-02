import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";

// --- Publix-specific helpers (kept for higher-quality CDN images) ---

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractItemCodeFromUrl(url: string): string | null {
  const m = url.match(/RIO-[A-Z]+-(\d+)/i);
  if (!m?.[1]) return null;
  return m[1].replace(/^0+(\d)/, "$1");
}

function extractSlugFromUrl(url: string): string | null {
  const m = url.match(/\/pd\/([^/?#]+)\//);
  return m?.[1] ?? null;
}

function buildPublixImageUrl(itemCode: string): string {
  const num = parseInt(itemCode, 10);
  if (isNaN(num)) return "";
  const folder = Math.floor(num / 5000) * 5000;
  const paddedCode = itemCode.padStart(6, "0");
  return `https://images.publixcdn.com/pct/images/products/${folder}/${paddedCode}-600x600-A.jpg`;
}

// --- URL slug fallback ---

function extractNameFromUrlSlug(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    // Take the longest slug-like segment from the path
    const segments = pathname.split("/").filter(Boolean);
    // Find the best candidate: longest segment that contains letters and hyphens/underscores
    let best: string | null = null;
    for (const seg of segments) {
      // Skip segments that are purely numeric, IDs, or very short
      if (/^\d+$/.test(seg) || /^[a-z]{1,2}\d+$/i.test(seg) || seg.length < 3) continue;
      // Prefer segments with hyphens (likely product names)
      if (!best || (seg.includes("-") && seg.length > best.length)) {
        best = seg;
      }
    }
    if (!best || !best.includes("-")) return null;
    return slugToTitle(best);
  } catch {
    return null;
  }
}

// --- Generic OG-tag scraper ---

function extractMeta(html: string, property: string): string | null {
  // Find all meta tags and check each one — more reliable than a single regex
  const metaTags = html.match(/<meta[^>]+>/gi) || [];
  for (const tag of metaTags) {
    const hasProperty =
      new RegExp(`(?:property|name)\\s*=\\s*["']${property}["']`, "i").test(tag);
    if (!hasProperty) continue;
    const contentMatch = tag.match(/content\s*=\s*["']([^"']*?)["']/i);
    if (contentMatch?.[1]) return contentMatch[1];
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1]?.trim().replace(/\s+/g, " ") ?? null;
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

async function scrapeGeneric(url: string): Promise<{ name: string | null; imageUrl: string | null }> {
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

  const rawName =
    extractMeta(html, "og:title") ??
    extractMeta(html, "twitter:title") ??
    extractTitle(html);

  const name = rawName ? decodeEntities(rawName) : null;

  const imageUrl =
    extractMeta(html, "og:image") ??
    extractMeta(html, "twitter:image") ??
    null;

  return { name: name || null, imageUrl };
}

// --- Route handler ---

export async function POST(request: Request) {
  try {
    await getAuthUser();
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Please provide a URL" }, { status: 400 });
    }

    // Validate it looks like a URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Publix fast path — use CDN image + slug-based name (higher quality)
    if (url.includes("publix.com")) {
      const itemCode = extractItemCodeFromUrl(url);
      const slug = extractSlugFromUrl(url);
      const name = slug ? slugToTitle(slug) : null;

      let imageUrl: string | null = null;
      if (itemCode) {
        const candidateUrl = buildPublixImageUrl(itemCode);
        try {
          const check = await fetch(candidateUrl, { method: "HEAD" });
          if (check.ok) imageUrl = candidateUrl;
        } catch {
          // image not found
        }
      }

      if (name) {
        return NextResponse.json({ name, description: null, imageUrl, itemCode });
      }
      // Fall through to generic scraper if Publix parsing fails
    }

    // Generic: fetch page and extract OG tags
    let name: string | null = null;
    let imageUrl: string | null = null;

    try {
      const scraped = await scrapeGeneric(url);
      name = scraped.name;
      imageUrl = scraped.imageUrl;
    } catch {
      // Fetch failed (403, timeout, etc.) — fall through to slug fallback
    }

    // Fallback: extract product name from URL slug
    if (!name) {
      name = extractNameFromUrlSlug(url);
    }

    if (!name) {
      return NextResponse.json(
        { error: "Could not extract product info from this page." },
        { status: 422 }
      );
    }

    return NextResponse.json({ name, description: null, imageUrl, itemCode: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}
