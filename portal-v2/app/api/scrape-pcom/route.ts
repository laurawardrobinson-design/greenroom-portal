import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Extract item code from Publix URL: /RIO-FNU-591951 or /RIO-PDP-0000000012345
// Preserves original digits (including leading zeros if any) for image URL construction
function extractItemCodeFromUrl(url: string): string | null {
  const m = url.match(/RIO-[A-Z]+-(\d+)/i);
  if (!m?.[1]) return null;
  // Strip leading zeros but keep at least one digit
  return m[1].replace(/^0+(\d)/, "$1");
}

function extractSlugFromUrl(url: string): string | null {
  const m = url.match(/\/pd\/([^/?#]+)\//);
  return m?.[1] ?? null;
}

// Build Publix CDN image URL from item code.
// Pattern confirmed from existing products:
//   folder = floor(itemCode / 5000) * 5000
//   url = https://images.publixcdn.com/pct/images/products/{folder}/{itemCode}-600x600-A.jpg
// Item codes are zero-padded to 6 digits in the URL.
function buildPublixImageUrl(itemCode: string): string {
  const num = parseInt(itemCode, 10);
  if (isNaN(num)) return "";
  const folder = Math.floor(num / 5000) * 5000;
  const paddedCode = itemCode.padStart(6, "0");
  return `https://images.publixcdn.com/pct/images/products/${folder}/${paddedCode}-600x600-A.jpg`;
}

export async function POST(request: Request) {
  try {
    await getAuthUser();
    const { url } = await request.json();

    if (!url || !url.includes("publix.com")) {
      return NextResponse.json(
        { error: "Please provide a valid Publix.com URL" },
        { status: 400 }
      );
    }

    const itemCode = extractItemCodeFromUrl(url);
    const slug = extractSlugFromUrl(url);

    const name = slug ? slugToTitle(slug) : null;

    if (!name) {
      return NextResponse.json(
        { error: "Could not extract product info. Make sure it's a Publix product detail page." },
        { status: 422 }
      );
    }

    // Construct image URL from item code using confirmed CDN pattern
    let imageUrl: string | null = null;
    if (itemCode) {
      const candidateUrl = buildPublixImageUrl(itemCode);
      // Verify the image actually exists
      try {
        const check = await fetch(candidateUrl, { method: "HEAD" });
        if (check.ok) imageUrl = candidateUrl;
      } catch {
        // image not found — leave null
      }
    }

    return NextResponse.json({ name, description: null, imageUrl, itemCode });
  } catch (error) {
    return authErrorResponse(error);
  }
}
