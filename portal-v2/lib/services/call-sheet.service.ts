import { createAdminClient } from "@/lib/supabase/admin";
import type { CallSheetData, CallSheetCrewEntry } from "@/types/domain";

export async function generateCallSheet(
  campaignId: string,
  shootId: string,
  dateId?: string
): Promise<CallSheetData> {
  const db = createAdminClient();

  // Fetch campaign
  const { data: campaign } = await db
    .from("campaigns")
    .select("*, users!campaigns_producer_id_fkey(name, phone, email)")
    .eq("id", campaignId)
    .single();

  if (!campaign) throw new Error("Campaign not found");

  // Fetch shoot with dates
  const { data: shoot } = await db
    .from("shoots")
    .select("*, shoot_dates(*)")
    .eq("id", shootId)
    .single();

  if (!shoot) throw new Error("Shoot not found");

  // Pick the specific date or first date
  const dates = (shoot.shoot_dates || []) as Record<string, unknown>[];
  const targetDate = dateId
    ? dates.find((d) => d.id === dateId)
    : dates[0];

  // Fetch crew for this shoot (with user details)
  let crewQuery = db
    .from("shoot_crew")
    .select("*, users(name, phone, email)")
    .eq("shoot_id", shootId);

  if (dateId) {
    crewQuery = crewQuery.or(`shoot_date_id.eq.${dateId},shoot_date_id.is.null`);
  }

  const { data: crewRows } = await crewQuery;

  const crew: CallSheetCrewEntry[] = (crewRows || []).map((c) => {
    const user = (c as Record<string, unknown>).users as Record<string, unknown>;
    return {
      name: (user?.name as string) || "TBD",
      role: c.role_on_shoot || "",
      phone: (user?.phone as string) || "",
      email: (user?.email as string) || "",
      callTime: (targetDate?.call_time as string) || null,
    };
  });

  // Fetch vendors assigned to this campaign
  const { data: vendorAssignments } = await db
    .from("campaign_vendors")
    .select("*, vendors(company_name, contact_name, phone, email, category)")
    .eq("campaign_id", campaignId)
    .not("status", "eq", "Rejected");

  const vendors = (vendorAssignments || []).map((v) => {
    const vendor = (v as Record<string, unknown>).vendors as Record<string, unknown>;
    return {
      company: (vendor?.company_name as string) || "",
      contact: (vendor?.contact_name as string) || "",
      phone: (vendor?.phone as string) || "",
      email: (vendor?.email as string) || "",
      role: (vendor?.category as string) || "",
    };
  });

  // Fetch deliverables
  const { data: deliverables } = await db
    .from("campaign_deliverables")
    .select("channel, format, width, height")
    .eq("campaign_id", campaignId);

  const deliverableList = (deliverables || []).map((d) => ({
    channel: d.channel || "",
    format: d.format || "",
    dimensions: `${d.width}x${d.height}`,
  }));

  // Producer info
  const producerData = (campaign as Record<string, unknown>).users as Record<string, unknown> | null;
  const producer = producerData
    ? {
        name: (producerData.name as string) || "",
        phone: (producerData.phone as string) || "",
        email: (producerData.email as string) || "",
      }
    : null;

  return {
    campaignName: campaign.name || "",
    wfNumber: campaign.wf_number || "",
    shootDate: (targetDate?.shoot_date as string) || "",
    location: (targetDate?.location as string) || shoot.location || "",
    callTime: (targetDate?.call_time as string) || null,
    crew,
    vendors,
    deliverables: deliverableList,
    notes: shoot.notes || "",
    producer,
  };
}

export function formatCallSheetText(data: CallSheetData): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════");
  lines.push(`CALL SHEET`);
  lines.push("═══════════════════════════════════════════════");
  lines.push("");
  lines.push(`Campaign: ${data.campaignName} (${data.wfNumber})`);
  lines.push(`Date: ${data.shootDate ? new Date(data.shootDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "TBD"}`);
  lines.push(`Location: ${data.location || "TBD"}`);
  if (data.callTime) lines.push(`General Call Time: ${data.callTime}`);
  lines.push("");

  if (data.producer) {
    lines.push("── PRODUCER ──");
    lines.push(`${data.producer.name}  |  ${data.producer.phone}  |  ${data.producer.email}`);
    lines.push("");
  }

  if (data.crew.length > 0) {
    lines.push("── CREW ──");
    for (const c of data.crew) {
      const callInfo = c.callTime ? ` | Call: ${c.callTime}` : "";
      lines.push(`${c.role.padEnd(20)} ${c.name.padEnd(24)} ${c.phone}${callInfo}`);
    }
    lines.push("");
  }

  if (data.vendors.length > 0) {
    lines.push("── VENDORS ──");
    for (const v of data.vendors) {
      lines.push(`${v.role.padEnd(20)} ${v.company} (${v.contact})  |  ${v.phone}`);
    }
    lines.push("");
  }

  if (data.deliverables.length > 0) {
    lines.push("── DELIVERABLES ──");
    for (const d of data.deliverables) {
      lines.push(`${d.channel} — ${d.format} (${d.dimensions})`);
    }
    lines.push("");
  }

  if (data.notes) {
    lines.push("── NOTES ──");
    lines.push(data.notes);
    lines.push("");
  }

  lines.push("═══════════════════════════════════════════════");

  return lines.join("\n");
}

export function generateMailtoLink(data: CallSheetData): string {
  const allEmails = [
    ...data.crew.map((c) => c.email),
    ...data.vendors.map((v) => v.email),
  ].filter(Boolean);

  const subject = encodeURIComponent(
    `Call Sheet — ${data.campaignName} (${data.wfNumber}) — ${data.shootDate ? new Date(data.shootDate).toLocaleDateString() : "TBD"}`
  );

  const body = encodeURIComponent(formatCallSheetText(data));

  return `mailto:${allEmails.join(",")}?subject=${subject}&body=${body}`;
}
