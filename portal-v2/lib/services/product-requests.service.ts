import { createAdminClient } from "@/lib/supabase/admin";
import { PR_DEPARTMENTS } from "@/types/domain";
import type {
  PRDoc,
  PRDeptSection,
  PRItem,
  PREvent,
  PRDocStatus,
  PRDepartment,
  PRSectionPublicView,
  DeptCalendarEntry,
  DeptCalendarView,
  DeptCalendarTokenRow,
  MasterCalendarView,
  Product,
  ProductDepartment,
  ProductLifecyclePhase,
} from "@/types/domain";

// --- Mapping helpers ---

function toProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    department: row.department as ProductDepartment,
    itemCode: (row.item_code as string) || null,
    description: (row.description as string) || "",
    shootingNotes: (row.shooting_notes as string) || "",
    restrictions: (row.restrictions as string) || "",
    pcomLink: (row.pcom_link as string) || null,
    rpGuideUrl: (row.rp_guide_url as string) || null,
    imageUrl: (row.image_url as string) || null,
    lifecyclePhase:
      ((row.lifecycle_phase as ProductLifecyclePhase) ?? "live") as ProductLifecyclePhase,
    createdBy: (row.created_by as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toItem(row: Record<string, unknown>): PRItem {
  return {
    id: row.id as string,
    sectionId: row.section_id as string,
    productId: (row.product_id as string) || null,
    name: (row.name as string) || "",
    quantity: Number(row.quantity) || 1,
    size: (row.size as string) || "",
    specialInstructions: (row.special_instructions as string) || "",
    fromShotList: Boolean(row.from_shot_list),
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    product: row.products ? toProduct(row.products as Record<string, unknown>) : undefined,
  };
}

function toItemLite(row: Record<string, unknown>): PRItem {
  return {
    id: row.id as string,
    sectionId: row.section_id as string,
    productId: (row.product_id as string) || null,
    name: "",
    quantity: Number(row.quantity) || 1,
    size: "",
    specialInstructions: "",
    fromShotList: false,
    sortOrder: Number(row.sort_order) || 0,
    createdAt: (row.created_at as string) || "",
    updatedAt: (row.updated_at as string) || "",
    product: undefined,
  };
}

function toSection(row: Record<string, unknown>, items: PRItem[] = []): PRDeptSection {
  return {
    id: row.id as string,
    docId: row.doc_id as string,
    department: row.department as PRDepartment,
    dateNeeded: (row.date_needed as string) || null,
    timeNeeded: (row.time_needed as string) || "",
    pickupPerson: (row.pickup_person as string) || "",
    pickupPhone: (row.pickup_phone as string) || "",
    publicToken: (row.public_token as string) || "",
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at as string,
    items,
  };
}

function toDoc(
  row: Record<string, unknown>,
  sections: PRDeptSection[] = []
): PRDoc {
  const campaign = row.campaigns as Record<string, unknown> | null;
  return {
    id: row.id as string,
    docNumber: row.doc_number as string,
    campaignId: row.campaign_id as string,
    shootDate: row.shoot_date as string,
    status: row.status as PRDocStatus,
    submittedBy: (row.submitted_by as string) || null,
    submittedAt: (row.submitted_at as string) || null,
    forwardedBy: (row.forwarded_by as string) || null,
    forwardedAt: (row.forwarded_at as string) || null,
    fulfilledAt: (row.fulfilled_at as string) || null,
    notes: (row.notes as string) || "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    sections,
    campaign: campaign
      ? {
          id: campaign.id as string,
          name: campaign.name as string,
          wfNumber: campaign.wf_number as string,
        }
      : undefined,
    submittedByName: (row.submitted_by_name as string) || null,
  };
}

// --- Queries ---

export async function listPRDocs(opts?: {
  campaignId?: string;
  status?: PRDocStatus | PRDocStatus[];
  detail?: "light" | "full";
}): Promise<PRDoc[]> {
  const db = createAdminClient();
  const detail = opts?.detail ?? "light";
  let q = db
    .from("product_request_docs")
    .select("*, campaigns(id, name, wf_number)")
    .order("shoot_date", { ascending: false });

  if (opts?.campaignId) q = q.eq("campaign_id", opts.campaignId);
  if (opts?.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
    q = q.in("status", statuses);
  }

  const { data, error } = await q;
  if (error) throw error;

  const docs = (data || []).map((r) => toDoc(r as Record<string, unknown>));
  if (docs.length === 0) return [];

  const docIds = docs.map((d) => d.id);

  const { data: sectionData, error: sectionErr } = await db
    .from("product_request_dept_sections")
    .select("*")
    .in("doc_id", docIds)
    .order("sort_order", { ascending: true });
  if (sectionErr) throw sectionErr;

  const sections = (sectionData || []).map((r) =>
    toSection(r as Record<string, unknown>)
  );
  const sectionIds = sections.map((s) => s.id);

  if (sectionIds.length === 0) return docs;

  const itemSelect =
    detail === "full"
      ? "*, products(id, name, department, item_code, image_url)"
      : "id, section_id, product_id, quantity, sort_order, created_at, updated_at";
  const { data: itemData, error: itemErr } = await db
    .from("product_request_items")
    .select(itemSelect)
    .in("section_id", sectionIds)
    .order("sort_order", { ascending: true });
  if (itemErr) throw itemErr;

  const items = (itemData || []).map((r) =>
    detail === "full"
      ? toItem(r as Record<string, unknown>)
      : toItemLite(r as Record<string, unknown>)
  );
  const itemsBySection = new Map<string, PRItem[]>();
  for (const item of items) {
    if (!itemsBySection.has(item.sectionId)) itemsBySection.set(item.sectionId, []);
    itemsBySection.get(item.sectionId)!.push(item);
  }

  const sectionsWithItems = sections.map((s) => ({
    ...s,
    items: itemsBySection.get(s.id) || [],
  }));

  const sectionsByDoc = new Map<string, PRDeptSection[]>();
  for (const s of sectionsWithItems) {
    if (!sectionsByDoc.has(s.docId)) sectionsByDoc.set(s.docId, []);
    sectionsByDoc.get(s.docId)!.push(s);
  }

  return docs.map((d) => ({ ...d, sections: sectionsByDoc.get(d.id) || [] }));
}

export async function getPRDoc(id: string): Promise<PRDoc> {
  const db = createAdminClient();

  const { data, error } = await db
    .from("product_request_docs")
    .select("*, campaigns(id, name, wf_number)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: sectionData, error: sectionErr } = await db
    .from("product_request_dept_sections")
    .select("*")
    .eq("doc_id", id)
    .order("sort_order", { ascending: true });
  if (sectionErr) throw sectionErr;

  const sections = (sectionData || []).map((r) =>
    toSection(r as Record<string, unknown>)
  );

  if (sections.length === 0) return toDoc(data as Record<string, unknown>, []);

  const sectionIds = sections.map((s) => s.id);
  const { data: itemData, error: itemErr } = await db
    .from("product_request_items")
    .select("*, products(id, name, department, item_code, image_url, shooting_notes, restrictions)")
    .in("section_id", sectionIds)
    .order("sort_order", { ascending: true });
  if (itemErr) throw itemErr;

  const items = (itemData || []).map((r) => toItem(r as Record<string, unknown>));
  const itemsBySection = new Map<string, PRItem[]>();
  for (const item of items) {
    if (!itemsBySection.has(item.sectionId)) itemsBySection.set(item.sectionId, []);
    itemsBySection.get(item.sectionId)!.push(item);
  }

  const sectionsWithItems = sections.map((s) => ({
    ...s,
    items: itemsBySection.get(s.id) || [],
  }));

  return toDoc(data as Record<string, unknown>, sectionsWithItems);
}

export async function getPREvents(docId: string): Promise<PREvent[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_request_events")
    .select("*, users(name)")
    .eq("doc_id", docId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data || []).map((r) => {
    const row = r as Record<string, unknown>;
    const user = row.users as Record<string, unknown> | null;
    return {
      id: row.id as string,
      docId: row.doc_id as string,
      actorId: (row.actor_id as string) || null,
      actorName: (user?.name as string) || null,
      fromStatus: (row.from_status as PRDocStatus) || null,
      toStatus: (row.to_status as PRDocStatus) || null,
      comment: (row.comment as string) || "",
      createdAt: row.created_at as string,
    };
  });
}

// --- Mutations ---

export async function createPRDoc(input: {
  campaignId: string;
  shootDate: string;
  submittedBy: string;
  notes?: string;
}): Promise<PRDoc> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_request_docs")
    .insert({
      campaign_id: input.campaignId,
      shoot_date: input.shootDate,
      submitted_by: input.submittedBy,
      notes: input.notes || "",
      doc_number: "",
    })
    .select("*, campaigns(id, name, wf_number)")
    .single();
  if (error) throw error;

  const doc = toDoc(data as Record<string, unknown>, []);
  await syncShotListProducts(doc.id, input.campaignId, input.shootDate);
  return getPRDoc(doc.id);
}

export async function updatePRDoc(
  id: string,
  input: { notes?: string; shootDate?: string }
): Promise<PRDoc> {
  const db = createAdminClient();
  const update: Record<string, unknown> = {};
  if (input.notes !== undefined) update.notes = input.notes;
  if (input.shootDate !== undefined) update.shoot_date = input.shootDate;
  const { error } = await db.from("product_request_docs").update(update).eq("id", id);
  if (error) throw error;
  return getPRDoc(id);
}

export async function transitionPRDoc(
  id: string,
  toStatus: PRDocStatus,
  actorId: string,
  comment = ""
): Promise<PRDoc> {
  const db = createAdminClient();

  const { data: current, error: fetchErr } = await db
    .from("product_request_docs")
    .select("status")
    .eq("id", id)
    .single();
  if (fetchErr) throw fetchErr;

  const fromStatus = (current as Record<string, unknown>).status as PRDocStatus;

  const update: Record<string, unknown> = { status: toStatus };
  if (toStatus === "submitted") update.submitted_at = new Date().toISOString();
  if (toStatus === "forwarded") {
    update.forwarded_by = actorId;
    update.forwarded_at = new Date().toISOString();
  }
  if (toStatus === "fulfilled") update.fulfilled_at = new Date().toISOString();

  const { error: updateErr } = await db
    .from("product_request_docs")
    .update(update)
    .eq("id", id);
  if (updateErr) throw updateErr;

  await db.from("product_request_events").insert({
    doc_id: id,
    actor_id: actorId,
    from_status: fromStatus,
    to_status: toStatus,
    comment,
  });

  return getPRDoc(id);
}

// --- Section mutations ---

export async function upsertSection(
  docId: string,
  department: PRDepartment,
  input: {
    dateNeeded?: string | null;
    timeNeeded?: string;
    pickupPerson?: string;
    pickupPhone?: string;
  }
): Promise<PRDeptSection> {
  const db = createAdminClient();

  const { data: existing } = await db
    .from("product_request_dept_sections")
    .select("*")
    .eq("doc_id", docId)
    .eq("department", department)
    .maybeSingle();

  if (existing) {
    const update: Record<string, unknown> = {};
    if (input.dateNeeded !== undefined) update.date_needed = input.dateNeeded;
    if (input.timeNeeded !== undefined) update.time_needed = input.timeNeeded;
    if (input.pickupPerson !== undefined) update.pickup_person = input.pickupPerson;
    if (input.pickupPhone !== undefined) update.pickup_phone = input.pickupPhone;
    const { data, error } = await db
      .from("product_request_dept_sections")
      .update(update)
      .eq("id", (existing as Record<string, unknown>).id)
      .select("*")
      .single();
    if (error) throw error;
    return toSection(data as Record<string, unknown>);
  }

  const deptOrder = ["Bakery", "Produce", "Deli", "Meat-Seafood", "Grocery"];
  const sortOrder = deptOrder.indexOf(department);

  const { data, error } = await db
    .from("product_request_dept_sections")
    .insert({
      doc_id: docId,
      department,
      date_needed: input.dateNeeded ?? null,
      time_needed: input.timeNeeded ?? "",
      pickup_person: input.pickupPerson ?? "",
      pickup_phone: input.pickupPhone ?? "",
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toSection(data as Record<string, unknown>);
}

export async function deleteSection(sectionId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("product_request_dept_sections")
    .delete()
    .eq("id", sectionId);
  if (error) throw error;
}

// --- Item mutations ---

export async function addItem(
  sectionId: string,
  input: {
    productId?: string | null;
    name?: string;
    quantity?: number;
    size?: string;
    specialInstructions?: string;
    fromShotList?: boolean;
    sortOrder?: number;
  }
): Promise<PRItem> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_request_items")
    .insert({
      section_id: sectionId,
      product_id: input.productId ?? null,
      name: input.name ?? "",
      quantity: input.quantity ?? 1,
      size: input.size ?? "",
      special_instructions: input.specialInstructions ?? "",
      from_shot_list: input.fromShotList ?? false,
      sort_order: input.sortOrder ?? 0,
    })
    .select("*, products(id, name, department, item_code, image_url)")
    .single();
  if (error) throw error;
  return toItem(data as Record<string, unknown>);
}

export async function updateItem(
  itemId: string,
  input: {
    quantity?: number;
    size?: string;
    specialInstructions?: string;
    sortOrder?: number;
  }
): Promise<PRItem> {
  const db = createAdminClient();
  const update: Record<string, unknown> = {};
  if (input.quantity !== undefined) update.quantity = input.quantity;
  if (input.size !== undefined) update.size = input.size;
  if (input.specialInstructions !== undefined)
    update.special_instructions = input.specialInstructions;
  if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;

  const { data, error } = await db
    .from("product_request_items")
    .update(update)
    .eq("id", itemId)
    .select("*, products(id, name, department, item_code, image_url)")
    .single();
  if (error) throw error;
  return toItem(data as Record<string, unknown>);
}

export async function deleteItem(itemId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("product_request_items")
    .delete()
    .eq("id", itemId);
  if (error) throw error;
}

// --- Shot list sync ---
// Pulls all products in the campaign's shot list, groups by department,
// and pre-populates sections + items (marked from_shot_list = true).
// Safe to call multiple times — skips products already in the doc.

export async function syncShotListProducts(
  docId: string,
  campaignId: string,
  defaultDateNeeded?: string | null
): Promise<void> {
  const db = createAdminClient();

  // Join through shot_product_links → campaign_products → products
  const { data: cpRows, error: cpErr } = await db
    .from("campaign_products")
    .select("product_id, products(id, name, department, item_code)")
    .eq("campaign_id", campaignId);
  if (cpErr) throw cpErr;

  type ProductRow = { id: string; name: string; department: string; item_code: string | null };
  const productsByDept = new Map<string, ProductRow[]>();
  const seen = new Set<string>();

  for (const row of cpRows || []) {
    const r = row as Record<string, unknown>;
    const product = r.products as ProductRow | null;
    if (!product || seen.has(product.id)) continue;
    seen.add(product.id);

    const dept = product.department;
    if (!PR_DEPARTMENTS.includes(dept as PRDepartment)) continue;

    if (!productsByDept.has(dept)) productsByDept.set(dept, []);
    productsByDept.get(dept)!.push(product);
  }

  // Find sections/items already present in this doc to avoid duplication.
  const { data: existingSections } = await db
    .from("product_request_dept_sections")
    .select("department, product_request_items(product_id)")
    .eq("doc_id", docId);

  const existingByDept = new Map<string, Set<string>>();
  const existingDepts = new Set<string>();
  for (const s of existingSections || []) {
    const sec = s as Record<string, unknown>;
    const dept = sec.department as string;
    const items = (sec.product_request_items as { product_id: string }[]) || [];
    existingDepts.add(dept);
    existingByDept.set(dept, new Set(items.map((i) => i.product_id)));
  }

  // Always ensure all department sections exist. Prefill shoot date only
  // when the department section is being created for the first time.
  const sectionByDept = new Map<PRDepartment, PRDeptSection>();
  for (const dept of PR_DEPARTMENTS) {
    const section = await upsertSection(
      docId,
      dept,
      existingDepts.has(dept) ? {} : { dateNeeded: defaultDateNeeded ?? null }
    );
    sectionByDept.set(dept, section);
  }

  if (productsByDept.size === 0) return;

  for (const [dept, products] of productsByDept) {
    const section = sectionByDept.get(dept as PRDepartment);
    if (!section) continue;
    const alreadyPresent = existingByDept.get(dept) || new Set<string>();

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (alreadyPresent.has(p.id)) continue;
      await addItem(section.id, {
        productId: p.id,
        fromShotList: true,
        sortOrder: i,
      });
    }
  }
}

// --- Public view by section token ---

export async function getPRSectionByToken(
  token: string
): Promise<PRSectionPublicView | null> {
  const db = createAdminClient();

  const { data: sectionRow, error: sectionErr } = await db
    .from("product_request_dept_sections")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (sectionErr) throw sectionErr;
  if (!sectionRow) return null;

  const sectionRecord = sectionRow as Record<string, unknown>;
  const docId = sectionRecord.doc_id as string;

  const { data: docRow, error: docErr } = await db
    .from("product_request_docs")
    .select("*, campaigns(id, name, wf_number, brand)")
    .eq("id", docId)
    .single();
  if (docErr) throw docErr;

  const { data: itemRows, error: itemErr } = await db
    .from("product_request_items")
    .select(
      "*, products(id, name, department, item_code, image_url, shooting_notes, restrictions, rp_guide_url)"
    )
    .eq("section_id", sectionRecord.id as string)
    .order("sort_order", { ascending: true });
  if (itemErr) throw itemErr;

  const items = (itemRows || []).map((r) =>
    toItem(r as Record<string, unknown>)
  );
  const section = toSection(sectionRecord, items);

  const docData = docRow as Record<string, unknown>;
  const campaignRow = (docData.campaigns as Record<string, unknown> | null) ?? null;
  const campaignId = (docData.campaign_id as string) || "";

  let callTime = "";
  let location = "";
  if (campaignId) {
    const { data: shootDay } = await db
      .from("shoot_days")
      .select("call_time, location")
      .eq("campaign_id", campaignId)
      .eq("shoot_date", docData.shoot_date as string)
      .maybeSingle();
    if (shootDay) {
      const sd = shootDay as Record<string, unknown>;
      callTime = (sd.call_time as string) || "";
      location = (sd.location as string) || "";
    }
  }

  return {
    docNumber: docData.doc_number as string,
    status: docData.status as PRDocStatus,
    campaign: {
      id: (campaignRow?.id as string) || "",
      name: (campaignRow?.name as string) || "",
      wfNumber: (campaignRow?.wf_number as string) || "",
      brand: (campaignRow?.brand as string) || "",
    },
    shoot: {
      date: docData.shoot_date as string,
      callTime,
      location,
    },
    notes: (docData.notes as string) || "",
    section,
  };
}

// --- Department calendar (tokenized + master) ---

// Statuses that should appear on a calendar shared with vendors.
// Submitted PRs are internal (producer → BMM), so not included.
const CALENDAR_STATUSES: PRDocStatus[] = ["forwarded", "fulfilled"];

async function loadCalendarEntries(
  department?: PRDepartment
): Promise<DeptCalendarEntry[]> {
  const db = createAdminClient();

  let sectionQuery = db
    .from("product_request_dept_sections")
    .select(
      `id, department, date_needed, time_needed, pickup_person, pickup_phone, public_token,
       doc_id,
       product_request_docs!inner(id, doc_number, status, shoot_date, campaign_id,
         campaigns(id, name, wf_number, brand))`
    )
    .in("product_request_docs.status", CALENDAR_STATUSES);
  if (department) sectionQuery = sectionQuery.eq("department", department);

  const { data: sectionRows, error } = await sectionQuery;
  if (error) throw error;

  const rows = (sectionRows || []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  const sectionIds = rows.map((r) => r.id as string);

  // Item count per section
  const { data: itemRows } = await db
    .from("product_request_items")
    .select("section_id")
    .in("section_id", sectionIds);
  const countBySection = new Map<string, number>();
  for (const r of itemRows || []) {
    const sid = (r as Record<string, unknown>).section_id as string;
    countBySection.set(sid, (countBySection.get(sid) ?? 0) + 1);
  }

  // Shoot day details — campaign + shoot_date lookup
  const shootKeys = new Set<string>();
  for (const r of rows) {
    const doc = r.product_request_docs as Record<string, unknown>;
    const cid = doc.campaign_id as string;
    const sd = doc.shoot_date as string;
    if (cid && sd) shootKeys.add(`${cid}|${sd}`);
  }
  const shootMap = new Map<string, { callTime: string; location: string }>();
  if (shootKeys.size > 0) {
    const campaignIds = Array.from(
      new Set(Array.from(shootKeys).map((k) => k.split("|")[0]))
    );
    const { data: shootDayRows } = await db
      .from("shoot_days")
      .select("campaign_id, shoot_date, call_time, location")
      .in("campaign_id", campaignIds);
    for (const sd of shootDayRows || []) {
      const s = sd as Record<string, unknown>;
      const key = `${s.campaign_id as string}|${s.shoot_date as string}`;
      shootMap.set(key, {
        callTime: (s.call_time as string) || "",
        location: (s.location as string) || "",
      });
    }
  }

  const entries: DeptCalendarEntry[] = rows.map((r) => {
    const doc = r.product_request_docs as Record<string, unknown>;
    const campaign = doc.campaigns as Record<string, unknown> | null;
    const shootDate = doc.shoot_date as string;
    const campaignId = (doc.campaign_id as string) || "";
    const shoot = shootMap.get(`${campaignId}|${shootDate}`);
    return {
      docId: doc.id as string,
      docNumber: doc.doc_number as string,
      status: doc.status as PRDocStatus,
      department: r.department as PRDepartment,
      shootDate,
      campaign: {
        id: (campaign?.id as string) || "",
        name: (campaign?.name as string) || "",
        wfNumber: (campaign?.wf_number as string) || "",
        brand: (campaign?.brand as string) || "",
      },
      itemCount: countBySection.get(r.id as string) ?? 0,
      pickupDate: (r.date_needed as string) || null,
      pickupTime: (r.time_needed as string) || "",
      pickupPerson: (r.pickup_person as string) || "",
      pickupPhone: (r.pickup_phone as string) || "",
      shootCallTime: shoot?.callTime ?? "",
      shootLocation: shoot?.location ?? "",
      sectionToken: (r.public_token as string) || "",
    };
  });

  entries.sort((a, b) => a.shootDate.localeCompare(b.shootDate));
  return entries;
}

export async function getDeptCalendarByToken(
  token: string
): Promise<DeptCalendarView | null> {
  const db = createAdminClient();
  const { data: calendarRow, error } = await db
    .from("product_request_dept_calendars")
    .select("department")
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!calendarRow) return null;
  const department = (calendarRow as Record<string, unknown>)
    .department as PRDepartment;
  const entries = await loadCalendarEntries(department);
  return { department, entries };
}

export async function getMasterCalendar(): Promise<MasterCalendarView> {
  const db = createAdminClient();
  const { data: tokenRows, error } = await db
    .from("product_request_dept_calendars")
    .select("department, public_token")
    .order("department", { ascending: true });
  if (error) throw error;

  const tokens: DeptCalendarTokenRow[] = (tokenRows || []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      department: row.department as PRDepartment,
      publicToken: row.public_token as string,
    };
  });

  const entries = await loadCalendarEntries();
  return { tokens, entries };
}

// --- Email formatter for BMM "Forward to RBU" ---

export function formatPREmailBody(doc: PRDoc): string {
  const lines: string[] = [
    `PRODUCT REQUEST — ${doc.docNumber}`,
    `Campaign: ${doc.campaign?.wfNumber ?? ""} ${doc.campaign?.name ?? ""}`,
    `Shoot Date: ${new Date(doc.shootDate + "T12:00:00").toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`,
    "",
  ];

  for (const section of doc.sections) {
    const deptLabel =
      section.department === "Meat-Seafood" ? "Meat & Seafood" : section.department;
    const dateStr = section.dateNeeded
      ? new Date(section.dateNeeded + "T12:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "TBD";
    const timeStr = section.timeNeeded || "TBD";
    const pickup = section.pickupPerson || "TBD";

    lines.push(
      `${deptLabel.toUpperCase()} — ${dateStr} at ${timeStr} — Pickup: ${pickup}`
    );

    for (const item of section.items) {
      const code = item.product?.itemCode ? `${item.product.itemCode}  ` : "";
      const name = item.product?.name ?? "(no product)";
      const qty = `Qty: ${item.quantity}`;
      const size = item.size ? `  ${item.size}` : "";
      const notes = item.specialInstructions ? `  | ${item.specialInstructions}` : "";
      lines.push(`  • ${code}${name}  ${qty}${size}${notes}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}
