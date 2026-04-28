type ResolveInput = {
  pcomLink: string | null | undefined;
  itemCode: string | null | undefined;
  pcomLinkBrokenAt?: string | null | undefined;
};

export type ResolvedPublixLink = {
  href: string;
  label: string;
  isFallback: boolean;
} | null;

/**
 * Pick the best link to publix.com for a product.
 *
 * Priority:
 *   1. The saved pcom_link, if present and not flagged broken.
 *   2. A search URL built from item_code (resilient to Publix URL changes).
 *   3. null — no link possible.
 */
export function resolvePublixLink(input: ResolveInput): ResolvedPublixLink {
  const broken = !!input.pcomLinkBrokenAt;
  if (input.pcomLink && !broken) {
    return { href: input.pcomLink, label: "View on Publix.com", isFallback: false };
  }
  if (input.itemCode) {
    return {
      href: `https://www.publix.com/search?search=${encodeURIComponent(input.itemCode)}`,
      label: "Search on Publix.com",
      isFallback: true,
    };
  }
  return null;
}
