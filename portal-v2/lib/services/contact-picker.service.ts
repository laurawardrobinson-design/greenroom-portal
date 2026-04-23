import { createAdminClient } from "@/lib/supabase/admin";
import type { ContactPickerResult } from "@/types/domain";

// Searches users (internal team) + vendors (external) and returns a
// unified list for contact pickers — e.g. PR section pickup person.
export async function searchContacts(
  query: string,
  limit = 8
): Promise<ContactPickerResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const db = createAdminClient();
  const like = `%${trimmed.replace(/[%_]/g, "\\$&")}%`;

  const [usersRes, vendorsRes] = await Promise.all([
    db
      .from("users")
      .select("id, name, email, phone, title, role, active")
      .eq("active", true)
      .or(`name.ilike.${like},email.ilike.${like}`)
      .limit(limit),
    db
      .from("vendors")
      .select("id, contact_name, company_name, email, phone, category, active")
      .eq("active", true)
      .or(
        `contact_name.ilike.${like},company_name.ilike.${like},email.ilike.${like}`
      )
      .limit(limit),
  ]);

  const out: ContactPickerResult[] = [];

  for (const row of usersRes.data || []) {
    const r = row as Record<string, unknown>;
    const title = (r.title as string) || "";
    const role = (r.role as string) || "";
    out.push({
      id: r.id as string,
      source: "user",
      name: (r.name as string) || (r.email as string) || "",
      phone: (r.phone as string) || "",
      email: (r.email as string) || "",
      subtitle: title || role,
    });
  }

  for (const row of vendorsRes.data || []) {
    const r = row as Record<string, unknown>;
    const contact = (r.contact_name as string) || "";
    const company = (r.company_name as string) || "";
    const category = (r.category as string) || "";
    out.push({
      id: r.id as string,
      source: "vendor",
      name: contact || company,
      phone: (r.phone as string) || "",
      email: (r.email as string) || "",
      subtitle: [company, category].filter(Boolean).join(" · "),
    });
  }

  return out
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit * 2);
}
