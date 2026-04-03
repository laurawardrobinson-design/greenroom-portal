import { createAdminClient } from "@/lib/supabase/admin";
import type { OnboardingChecklist, OnboardingStatus } from "@/types/domain";

export const DEFAULT_ONBOARDING_ITEMS = [
  "W-9 on File",
  "Direct Deposit Setup",
  "I-9 Verified",
  "Deal Memo Signed",
];

function toItem(row: Record<string, unknown>): OnboardingChecklist {
  return {
    id: row.id as string,
    vendorId: row.vendor_id as string,
    itemName: row.item_name as string,
    completed: row.completed as boolean,
    completedDate: (row.completed_date as string) || null,
    expiresAt: (row.expires_at as string) || null,
    notes: (row.notes as string) || "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Get or seed checklist for a vendor
export async function getVendorOnboarding(vendorId: string): Promise<OnboardingChecklist[]> {
  const db = createAdminClient();

  // Check existing items
  const { data: existing } = await db
    .from("onboarding_checklists")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("item_name");

  // Seed any missing default items
  const existingNames = (existing || []).map((r) => r.item_name);
  const missing = DEFAULT_ONBOARDING_ITEMS.filter((n) => !existingNames.includes(n));

  if (missing.length > 0) {
    await db.from("onboarding_checklists").insert(
      missing.map((item_name) => ({ vendor_id: vendorId, item_name }))
    );
    // Re-fetch with newly seeded items
    const { data: all } = await db
      .from("onboarding_checklists")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("item_name");
    return (all || []).map(toItem);
  }

  return (existing || []).map(toItem);
}

export async function updateOnboardingItem(
  id: string,
  input: {
    completed?: boolean;
    completedDate?: string | null;
    expiresAt?: string | null;
    notes?: string;
  }
): Promise<OnboardingChecklist> {
  const db = createAdminClient();
  const updateData: Record<string, unknown> = {};
  if (input.completed !== undefined) updateData.completed = input.completed;
  if (input.completedDate !== undefined) updateData.completed_date = input.completedDate;
  if (input.expiresAt !== undefined) updateData.expires_at = input.expiresAt;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const { data, error } = await db
    .from("onboarding_checklists")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toItem(data);
}

export async function getOnboardingStatus(vendorId: string): Promise<OnboardingStatus> {
  const items = await getVendorOnboarding(vendorId);
  if (items.length === 0) return "none";
  const completedCount = items.filter((i) => i.completed).length;
  if (completedCount === 0) return "none";
  if (completedCount === items.length) return "complete";
  return "partial";
}

// Portal-wide: who's not fully onboarded (for HOP dashboard)
export async function listVendorOnboardingOverview(): Promise<
  Array<{
    vendorId: string;
    vendorName: string;
    status: OnboardingStatus;
    completedCount: number;
    totalCount: number;
    items: OnboardingChecklist[];
  }>
> {
  const db = createAdminClient();

  // Get all vendors who have been booked as crew
  const { data: bookedVendors } = await db
    .from("crew_bookings")
    .select("vendor_id, vendors(id, contact_name, company_name)")
    .not("vendor_id", "is", null)
    .neq("status", "Cancelled");

  if (!bookedVendors) return [];

  // Deduplicate vendors
  const seen = new Set<string>();
  const vendors: Array<{ id: string; name: string }> = [];
  for (const row of bookedVendors as any[]) {
    const v = row.vendors as Record<string, unknown> | null;
    if (!v || !row.vendor_id || seen.has(row.vendor_id)) continue;
    seen.add(row.vendor_id);
    vendors.push({
      id: row.vendor_id,
      name: (v.contact_name as string) || (v.company_name as string) || "Unknown",
    });
  }

  const results = [];
  for (const vendor of vendors) {
    const items = await getVendorOnboarding(vendor.id);
    const completedCount = items.filter((i) => i.completed).length;
    const totalCount = items.length;
    const status: OnboardingStatus =
      completedCount === 0 ? "none" : completedCount === totalCount ? "complete" : "partial";

    results.push({
      vendorId: vendor.id,
      vendorName: vendor.name,
      status,
      completedCount,
      totalCount,
      items,
    });
  }

  // Sort: incomplete first
  results.sort((a, b) => {
    const order = { none: 0, partial: 1, complete: 2 };
    return order[a.status] - order[b.status];
  });

  return results;
}
