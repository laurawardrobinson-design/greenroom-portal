import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CallSheetData,
  CallSheetCrewEntry,
  CallSheetContent,
  CallSheetRow,
  CallSheetVersion,
  CallSheetCrewRow,
  CallSheetTalentRow,
  CallSheetLocationRow,
  CallSheetDeliveryBlock,
} from "@/types/domain";
import { randomBytes } from "crypto";

// ============================================================
// Persistence (Wave 1 — migration 094)
// ============================================================

const DEFAULT_SAFETY_REMINDERS =
  "Safety Reminders:\n" +
  "Always wear closed toe shoes.\n" +
  "Dress for EXT or INT shoots with safety in mind.\n" +
  "Review call sheets for safety information.\n" +
  "Know where the first aid kit is located (ask the producer).\n" +
  "Be mindful of common production hazards:\n" +
  "  Tripping (wires, cables, boxes)\n" +
  "  Falling Objects (lighting, flags, stands)\n" +
  "  Electrical (breakout boxes and high voltage cabling)\n" +
  "  Vehicles\n" +
  "  Water";

const DEFAULT_ALLERGEN_BULLETIN =
  "Food Safety Reminder:\n" +
  "Declare all allergens in the morning safety meeting (nuts, dairy, gluten, shellfish, eggs, soy).\n" +
  "Keep raw and cooked surfaces separated.\n" +
  "Wash hands between handling product.\n" +
  "Any dietary restrictions — flag to the food stylist before call.";

export function emptyCallSheetContent(): CallSheetContent {
  return {
    companyName: "Publix Corporate",
    companyAddress: "3300 Publix Corporate Pkwy\nLakeland, FL 33811\n863-688-1188",
    location: "",
    parkingDirections: "",
    generalCallTime: "",
    shootingCallTime: "",
    breakfastTime: "",
    lunchTime: "",
    lunchVenue: "",
    estimatedWrap: "",
    companyMoves: "",
    walkieChannels: "",
    weatherNotes: "",
    weatherCachedAt: null,
    sunrise: "",
    sunset: "",
    goldenHour: "",
    emergencyHospital: "",
    emergencyAddress: "",
    emergencyPhone: "",
    urgentCareName: "",
    urgentCarePhone: "",
    policeNonEmergencyPhone: "",
    onSetMedic: "",
    allergenBulletin: DEFAULT_ALLERGEN_BULLETIN,
    safetyReminders: DEFAULT_SAFETY_REMINDERS,
    crew: [],
    talent: [],
    locations: [],
    specialInstructions: "",
    producer: null,
  };
}

function rowToCallSheet(
  row: Record<string, unknown>,
  currentVNumber: number | null = null,
  liveDeliveries: CallSheetDeliveryBlock[] = []
): CallSheetRow {
  const content = (row.content_draft as CallSheetContent) || emptyCallSheetContent();
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    shootDateId: (row.shoot_date_id as string | null) ?? null,
    shootDate: row.shoot_date as string,
    status: row.status as CallSheetRow["status"],
    contentDraft: { ...emptyCallSheetContent(), ...content },
    currentVersionId: (row.current_version_id as string | null) ?? null,
    currentVNumber,
    liveDeliveries,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function fetchCurrentVNumber(
  currentVersionId: string | null,
  db: AdminClient
): Promise<number | null> {
  if (!currentVersionId) return null;
  const { data } = await db
    .from("call_sheet_versions")
    .select("v_number")
    .eq("id", currentVersionId)
    .maybeSingle();
  return (data as { v_number?: number } | null)?.v_number ?? null;
}

/**
 * Pull the live Deliveries-Today block for a shoot_date: every non-cancelled
 * PRDoc tied to this date, grouped by department section, flattened to a list
 * of blocks the call sheet renders under "Deliveries Today". This is computed
 * on every fetch (not stored on content_draft) so producers always see current
 * PR state while editing the draft. On publish it gets snapshotted into the
 * version payload.
 */
async function fetchDeliveriesForShootDate(
  shootDateId: string | null,
  db: AdminClient
): Promise<CallSheetDeliveryBlock[]> {
  if (!shootDateId) return [];

  const { data: docs } = await db
    .from("product_request_docs")
    .select("id, doc_number, status")
    .eq("shoot_date_id", shootDateId)
    .neq("status", "cancelled");

  const docRows = (docs || []) as Array<Record<string, unknown>>;
  if (docRows.length === 0) return [];

  const docIds = docRows.map((d) => d.id as string);

  const { data: sections } = await db
    .from("product_request_dept_sections")
    .select("id, doc_id, department, time_needed, pickup_person, sort_order")
    .in("doc_id", docIds)
    .order("sort_order", { ascending: true });

  const sectionRows = (sections || []) as Array<Record<string, unknown>>;
  if (sectionRows.length === 0) return [];

  const sectionIds = sectionRows.map((s) => s.id as string);

  const { data: items } = await db
    .from("product_request_items")
    .select("section_id, name, quantity, special_instructions, sort_order, products(name)")
    .in("section_id", sectionIds)
    .order("sort_order", { ascending: true });

  const itemRows = (items || []) as Array<Record<string, unknown>>;
  const itemsBySection = new Map<string, CallSheetDeliveryBlock["items"]>();
  for (const item of itemRows) {
    const sectionId = item.section_id as string;
    if (!itemsBySection.has(sectionId)) itemsBySection.set(sectionId, []);
    const product = item.products as { name?: string } | null;
    itemsBySection.get(sectionId)!.push({
      name: (item.name as string) || product?.name || "—",
      quantity: Number(item.quantity ?? 0),
      notes: (item.special_instructions as string) || "",
    });
  }

  const docsById = new Map<string, Record<string, unknown>>(
    docRows.map((d) => [d.id as string, d])
  );

  const blocks: CallSheetDeliveryBlock[] = sectionRows
    .map((s) => {
      const doc = docsById.get(s.doc_id as string);
      if (!doc) return null;
      return {
        docId: doc.id as string,
        docNumber: (doc.doc_number as string) || "",
        docStatus: (doc.status as string) || "",
        department: (s.department as string) || "",
        pickupTime: (s.time_needed as string) || "",
        pickupPerson: (s.pickup_person as string) || "",
        items: itemsBySection.get(s.id as string) ?? [],
      } satisfies CallSheetDeliveryBlock;
    })
    .filter((b): b is CallSheetDeliveryBlock => b !== null && b.items.length > 0);

  return blocks;
}

function rowToVersion(row: Record<string, unknown>): CallSheetVersion {
  return {
    id: row.id as string,
    callSheetId: row.call_sheet_id as string,
    vNumber: row.v_number as number,
    payload: row.payload as CallSheetContent,
    publishedBy: (row.published_by as string | null) ?? null,
    publishedAt: row.published_at as string,
    supersededAt: (row.superseded_at as string | null) ?? null,
  };
}

type AdminClient = ReturnType<typeof createAdminClient>;

// Convert a Postgres time value like "05:00:00" into "5:00 AM".
// Leaves already-formatted strings untouched.
function formatCallTimeFromDb(raw: string): string {
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return raw;
  const hour24 = Number(match[1]);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}

async function buildInitialContent(
  campaignId: string,
  shootDateId: string | null,
  db: AdminClient
): Promise<CallSheetContent> {
  const content = emptyCallSheetContent();

  // Campaign + producer
  const { data: campaign } = await db
    .from("campaigns")
    .select("*, users!campaigns_producer_id_fkey(name, phone, email)")
    .eq("id", campaignId)
    .single();

  if (campaign) {
    const producer = (campaign as Record<string, unknown>).users as
      | Record<string, unknown>
      | null;
    content.producer = producer
      ? {
          name: (producer.name as string) || "",
          phone: (producer.phone as string) || "",
          email: (producer.email as string) || "",
        }
      : null;
  }

  if (!shootDateId) return content;

  // Shoot date + parent shoot
  const { data: shootDate } = await db
    .from("shoot_dates")
    .select("*, shoots!inner(*)")
    .eq("id", shootDateId)
    .single();

  if (!shootDate) return content;

  const shoot = (shootDate as Record<string, unknown>).shoots as Record<string, unknown>;

  content.generalCallTime = formatCallTimeFromDb((shootDate.call_time as string) || "");
  content.location = (shootDate.location as string) || (shoot?.location as string) || "";
  content.parkingDirections = (shootDate.parking_directions as string) || "";
  content.weatherNotes = (shootDate.weather_notes as string) || "";
  content.specialInstructions = (shootDate.special_instructions as string) || "";

  // Seed one location row from the shoot location
  if (content.location) {
    content.locations = [
      {
        id: `seed-loc-${shootDateId}`,
        label: (shoot?.name as string) || "Primary Location",
        address: content.location,
        mapLink: "",
        loadIn: "",
        parking: content.parkingDirections,
      },
    ];
  }

  // Seed crew from shoot_crew
  const shootId = shoot?.id as string;
  if (shootId) {
    const { data: crewRows } = await db
      .from("shoot_crew")
      .select("*, users(id, name, phone, email, role)")
      .eq("shoot_id", shootId);

    const crew: CallSheetCrewRow[] = [];

    // Producer first
    if (content.producer) {
      crew.push({
        id: `producer-${campaignId}`,
        name: content.producer.name,
        role: "Producer",
        dept: "Production",
        phone: content.producer.phone,
        email: content.producer.email,
        callTime: content.generalCallTime,
        contactVisibility: "full",
        sourceUserId: null,
      });
    }

    for (const c of crewRows || []) {
      const u = (c as Record<string, unknown>).users as Record<string, unknown> | null;
      if (!u) continue;
      crew.push({
        id: (c as Record<string, unknown>).id as string,
        name: (u.name as string) || "",
        role: ((c as Record<string, unknown>).role_on_shoot as string) || (u.role as string) || "",
        dept: (u.role as string) || "",
        phone: (u.phone as string) || "",
        email: (u.email as string) || "",
        callTime: content.generalCallTime,
        contactVisibility: "full",
        sourceUserId: (u.id as string) || null,
      });
    }
    content.crew = crew;
  }

  // Seed talent + non-talent vendors
  const { data: campaignVendors } = await db
    .from("campaign_vendors")
    .select("*, vendors(company_name, contact_name, phone, email, category)")
    .eq("campaign_id", campaignId)
    .not("status", "eq", "Rejected");

  const talent: CallSheetTalentRow[] = [];
  const extraCrew: CallSheetCrewRow[] = [];

  for (const cv of campaignVendors || []) {
    const v = (cv as Record<string, unknown>).vendors as Record<string, unknown> | null;
    if (!v) continue;
    const category = (v.category as string) || "";
    const isTalent = category.toLowerCase() === "talent";

    if (isTalent) {
      talent.push({
        id: `vendor-${(cv as Record<string, unknown>).id as string}`,
        name: (v.contact_name as string) || (v.company_name as string) || "",
        role: "Talent",
        phone: (v.phone as string) || "",
        email: (v.email as string) || "",
        callTime: content.generalCallTime,
        makeupWardrobeCall: "",
        pickupTime: "",
        agency: (v.company_name as string) || "",
        sourceVendorId: ((cv as Record<string, unknown>).vendor_id as string) || null,
      });
    } else {
      extraCrew.push({
        id: `vendor-${(cv as Record<string, unknown>).id as string}`,
        name: (v.contact_name as string) || (v.company_name as string) || "",
        role: category || (v.company_name as string) || "",
        dept: category || "",
        phone: (v.phone as string) || "",
        email: (v.email as string) || "",
        callTime: content.generalCallTime,
        contactVisibility: "full",
        sourceVendorId: ((cv as Record<string, unknown>).vendor_id as string) || null,
      });
    }
  }

  content.crew = [...content.crew, ...extraCrew];
  content.talent = talent;

  return content;
}

/**
 * Return the draft call sheet for a given shoot date. If `content_draft`
 * is empty, seed it from campaign + shoot_date + crew + vendors and persist
 * the seed. After first fetch, the draft is the source of truth.
 */
export async function getOrCreateDraftByShootDate(
  campaignId: string,
  shootDateId: string
): Promise<CallSheetRow> {
  const db = createAdminClient();

  // Find the call sheet for this shoot date (auto-created by trigger).
  // A sheet row is always the editable draft; publishing snapshots it to
  // call_sheet_versions but leaves the sheet row in place for further edits.
  const { data: existing } = await db
    .from("call_sheets")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("shoot_date_id", shootDateId)
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let row = existing as Record<string, unknown> | null;

  if (!row) {
    // Trigger should have made one; if not, create it here
    const { data: shootDate } = await db
      .from("shoot_dates")
      .select("shoot_date")
      .eq("id", shootDateId)
      .single();

    if (!shootDate) throw new Error("Shoot date not found");

    const { data: inserted, error } = await db
      .from("call_sheets")
      .insert({
        campaign_id: campaignId,
        shoot_date_id: shootDateId,
        shoot_date: (shootDate as Record<string, unknown>).shoot_date as string,
        status: "draft",
      })
      .select("*")
      .single();

    if (error) throw error;
    row = inserted as Record<string, unknown>;
  }

  const [currentVNumber, liveDeliveries] = await Promise.all([
    fetchCurrentVNumber((row.current_version_id as string | null) ?? null, db),
    fetchDeliveriesForShootDate(shootDateId, db),
  ]);
  const sheet = rowToCallSheet(row, currentVNumber, liveDeliveries);

  // Seed content on first fetch
  const contentIsEmpty =
    !row.content_draft ||
    typeof row.content_draft !== "object" ||
    Object.keys(row.content_draft as object).length === 0;

  if (contentIsEmpty) {
    const seeded = await buildInitialContent(campaignId, shootDateId, db);
    await db
      .from("call_sheets")
      .update({ content_draft: seeded })
      .eq("id", sheet.id);
    sheet.contentDraft = seeded;
  }

  return sheet;
}

export async function getCallSheet(id: string): Promise<CallSheetRow | null> {
  const db = createAdminClient();
  const { data } = await db.from("call_sheets").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const [currentVNumber, liveDeliveries] = await Promise.all([
    fetchCurrentVNumber((row.current_version_id as string | null) ?? null, db),
    fetchDeliveriesForShootDate((row.shoot_date_id as string | null) ?? null, db),
  ]);
  return rowToCallSheet(row, currentVNumber, liveDeliveries);
}

export async function updateDraft(
  id: string,
  contentPatch: Partial<CallSheetContent>
): Promise<CallSheetRow> {
  const db = createAdminClient();

  const { data: existing, error: fetchErr } = await db
    .from("call_sheets")
    .select("content_draft, status")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) throw new Error("Call sheet not found");
  if ((existing as Record<string, unknown>).status === "archived") {
    throw new Error("Cannot edit an archived call sheet");
  }

  const current = ((existing as Record<string, unknown>).content_draft as CallSheetContent) ||
    emptyCallSheetContent();
  const merged: CallSheetContent = { ...emptyCallSheetContent(), ...current, ...contentPatch };

  const { data: updated, error } = await db
    .from("call_sheets")
    .update({ content_draft: merged })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  const row = updated as Record<string, unknown>;
  const [currentVNumber, liveDeliveries] = await Promise.all([
    fetchCurrentVNumber((row.current_version_id as string | null) ?? null, db),
    fetchDeliveriesForShootDate((row.shoot_date_id as string | null) ?? null, db),
  ]);
  return rowToCallSheet(row, currentVNumber, liveDeliveries);
}

/**
 * Snapshot the current draft into an immutable version, mark the
 * previous current version as superseded, and point current_version_id
 * at the new version. Returns the new version.
 */
export async function publishVersion(
  callSheetId: string,
  publishedBy: string
): Promise<CallSheetVersion> {
  const db = createAdminClient();

  const { data: sheet, error } = await db
    .from("call_sheets")
    .select("*")
    .eq("id", callSheetId)
    .single();

  if (error || !sheet) throw new Error("Call sheet not found");

  const row = sheet as Record<string, unknown>;
  const content = (row.content_draft as CallSheetContent) || emptyCallSheetContent();

  // Required-field check for publish
  if (!content.emergencyHospital || !content.emergencyAddress || !content.emergencyPhone) {
    throw new Error("Cannot publish: hospital name, address, and phone are required");
  }
  if (!content.generalCallTime) {
    throw new Error("Cannot publish: general call time is required");
  }

  // Snapshot live deliveries into the payload so the published version
  // records what was going to be delivered at publish time, independent
  // of any later edits to the underlying PRDocs.
  const deliveries = await fetchDeliveriesForShootDate(
    (row.shoot_date_id as string | null) ?? null,
    db
  );
  const snapshotContent: CallSheetContent & { deliveries: CallSheetDeliveryBlock[] } = {
    ...content,
    deliveries,
  };

  // Find next v_number
  const { data: latest } = await db
    .from("call_sheet_versions")
    .select("v_number")
    .eq("call_sheet_id", callSheetId)
    .order("v_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextV = ((latest as { v_number?: number } | null)?.v_number ?? 0) + 1;

  // Insert new version
  const { data: newVersion, error: insertErr } = await db
    .from("call_sheet_versions")
    .insert({
      call_sheet_id: callSheetId,
      v_number: nextV,
      payload: snapshotContent,
      published_by: publishedBy,
    })
    .select("*")
    .single();

  if (insertErr || !newVersion) throw insertErr || new Error("Failed to create version");

  const versionRow = newVersion as Record<string, unknown>;

  // Mark previous current as superseded
  if (row.current_version_id) {
    await db
      .from("call_sheet_versions")
      .update({ superseded_at: new Date().toISOString() })
      .eq("id", row.current_version_id as string);
  }

  // Update the call_sheet pointer. The sheet row itself stays editable —
  // publishing snapshots into call_sheet_versions but does not freeze the
  // draft; further edits are always welcome and can be published as v+1.
  await db
    .from("call_sheets")
    .update({ current_version_id: versionRow.id as string })
    .eq("id", callSheetId);

  return rowToVersion(versionRow);
}

export async function listVersions(callSheetId: string): Promise<CallSheetVersion[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("call_sheet_versions")
    .select("*")
    .eq("call_sheet_id", callSheetId)
    .order("v_number", { ascending: false });

  return (data || []).map((r) => rowToVersion(r as Record<string, unknown>));
}

export async function getVersion(versionId: string): Promise<CallSheetVersion | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("call_sheet_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (!data) return null;
  return rowToVersion(data as Record<string, unknown>);
}

// ============================================================
// PDF adapter — bridge new content shape to existing generator
// ============================================================

export function contentToPdfData(
  content: CallSheetContent,
  campaignName: string,
  wfNumber: string,
  shootDate: string
): CallSheetData {
  const crewEntries: CallSheetCrewEntry[] = content.crew
    .filter((c) => c.role !== "Producer")
    .map((c) => ({
      name: c.name,
      role: c.role,
      phone: c.contactVisibility === "full" ? c.phone : "",
      email: c.contactVisibility === "full" ? c.email : "reach out to producer for contact",
      callTime: c.callTime || null,
    }));

  return {
    campaignName,
    wfNumber,
    shootDate,
    location: content.location,
    callTime: content.generalCallTime || null,
    crew: crewEntries,
    vendors: content.talent.map((t) => ({
      company: t.agency,
      contact: t.name,
      phone: t.phone,
      email: t.email,
      role: "Talent",
    })),
    deliverables: [],
    notes: content.specialInstructions,
    producer: content.producer,
  };
}

// ============================================================
// Distribution (stubs for later sub-steps of Wave 1)
// ============================================================

export function generateAckToken(): string {
  return randomBytes(24).toString("base64url");
}


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
