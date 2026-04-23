// Publix Lines of Business — single source of truth for the enum
// shipped in migration 081. Add new values here AND in the DB check
// constraint (see migration 081 and any future expansion migration).

export const LINES_OF_BUSINESS = [
  "Bakery",
  "Deli",
  "Produce",
  "Meat & Seafood",
  "Grocery",
  "Health & Wellness",
  "Pharmacy",
] as const;

export type LineOfBusiness = (typeof LINES_OF_BUSINESS)[number];

export function isLineOfBusiness(value: unknown): value is LineOfBusiness {
  return (
    typeof value === "string" &&
    (LINES_OF_BUSINESS as readonly string[]).includes(value)
  );
}

// One neutral treatment for every LOB — the department name carries the
// meaning, not color. Keeping the export shape so callers don't need to
// change; every value resolves to the same muted chip style.
const NEUTRAL_CHIP = "bg-surface-secondary text-text-secondary ring-border";

export const LOB_CHIP_STYLES: Record<LineOfBusiness, string> = {
  Bakery: NEUTRAL_CHIP,
  Deli: NEUTRAL_CHIP,
  Produce: NEUTRAL_CHIP,
  "Meat & Seafood": NEUTRAL_CHIP,
  Grocery: NEUTRAL_CHIP,
  "Health & Wellness": NEUTRAL_CHIP,
  Pharmacy: NEUTRAL_CHIP,
};
