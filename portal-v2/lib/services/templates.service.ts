import { createClient } from "@/lib/supabase/server";
import type {
  AssetTemplate,
  TemplateLayer,
  TemplateLayerProps,
  TemplateLayerType,
  TemplateOutputSpec,
  TemplateStatus,
  TemplateVersion,
  TemplateVersionSnapshot,
} from "@/types/domain";

// ─── Mappers ─────────────────────────────────────────────────────────────────

function toLayer(row: Record<string, unknown>): TemplateLayer {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    name: row.name as string,
    layerType: row.layer_type as TemplateLayerType,
    isDynamic: Boolean(row.is_dynamic),
    isLocked: Boolean(row.is_locked),
    dataBinding: (row.data_binding as string) ?? "",
    staticValue: (row.static_value as string) ?? "",
    xPct: Number(row.x_pct ?? 0),
    yPct: Number(row.y_pct ?? 0),
    widthPct: Number(row.width_pct ?? 100),
    heightPct: Number(row.height_pct ?? 100),
    rotationDeg: Number(row.rotation_deg ?? 0),
    zIndex: Number(row.z_index ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    props: (row.props as TemplateLayerProps) ?? {},
    locales: (row.locales as Record<string, string>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toOutputSpec(row: Record<string, unknown>): TemplateOutputSpec {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    label: row.label as string,
    width: Number(row.width),
    height: Number(row.height),
    channel: (row.channel as string) ?? "",
    format: (row.format as TemplateOutputSpec["format"]) ?? "png",
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at as string,
  };
}

function toTemplate(row: Record<string, unknown>): AssetTemplate {
  const layers = (row.template_layers as Record<string, unknown>[] | undefined)
    ?.map(toLayer)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const outputSpecs = (row.template_output_specs as Record<string, unknown>[] | undefined)
    ?.map(toOutputSpec)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const versions = (row.template_versions as Record<string, unknown>[] | undefined)
    ?.map(toVersion)
    .sort((a, b) => b.version - a.version);
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    status: row.status as TemplateStatus,
    category: (row.category as string) ?? "general",
    brandTokensId: (row.brand_tokens_id as string | null) ?? null,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    canvasWidth: Number(row.canvas_width ?? 1080),
    canvasHeight: Number(row.canvas_height ?? 1080),
    backgroundColor: (row.background_color as string) ?? "#FFFFFF",
    currentVersionId: (row.current_version_id as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    layers,
    outputSpecs,
    versions,
  };
}

function toVersion(row: Record<string, unknown>): TemplateVersion {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    version: Number(row.version),
    label: (row.label as string) ?? "",
    notes: (row.notes as string) ?? "",
    snapshot: (row.snapshot as TemplateVersionSnapshot) ?? {
      template: {
        name: "",
        description: "",
        category: "general",
        brandTokensId: null,
        canvasWidth: 1080,
        canvasHeight: 1080,
        backgroundColor: "#FFFFFF",
      },
      layers: [],
      outputSpecs: [],
    },
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function listTemplates(filters?: {
  status?: TemplateStatus;
  search?: string;
}): Promise<AssetTemplate[]> {
  const supabase = await createClient();
  let q = supabase
    .from("templates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.search) q = q.ilike("name", `%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toTemplate);
}

export async function getTemplate(id: string): Promise<AssetTemplate | null> {
  const supabase = await createClient();
  // Try the full join first — includes versions so the editor can show the
  // history dropdown. If PostgREST hasn't picked up the template_versions FK
  // yet (schema-cache lag after a fresh migration), fall back to the layers
  // + specs join and load versions in a second query.
  const withVersions = await supabase
    .from("templates")
    .select("*, template_layers(*), template_output_specs(*), template_versions(*)")
    .eq("id", id)
    .single();
  if (!withVersions.error && withVersions.data) {
    return toTemplate(withVersions.data);
  }

  const { data, error } = await supabase
    .from("templates")
    .select("*, template_layers(*), template_output_specs(*)")
    .eq("id", id)
    .single();
  if (error || !data) {
    console.warn("getTemplate: fallback select failed", error);
    return null;
  }
  // Load versions separately (best-effort).
  const { data: vs } = await supabase
    .from("template_versions")
    .select("*")
    .eq("template_id", id)
    .order("version", { ascending: false });
  return toTemplate({ ...data, template_versions: vs ?? [] });
}

export async function createTemplate(input: {
  name: string;
  description?: string;
  category?: string;
  brandTokensId?: string | null;
  canvasWidth?: number;
  canvasHeight?: number;
  backgroundColor?: string;
  createdBy?: string | null;
}): Promise<AssetTemplate> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .insert({
      name: input.name,
      description: input.description ?? "",
      category: input.category ?? "general",
      brand_tokens_id: input.brandTokensId ?? null,
      canvas_width: input.canvasWidth ?? 1080,
      canvas_height: input.canvasHeight ?? 1080,
      background_color: input.backgroundColor ?? "#FFFFFF",
      created_by: input.createdBy ?? null,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw error;
  return toTemplate(data);
}

export async function updateTemplate(
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    status: TemplateStatus;
    category: string;
    brandTokensId: string | null;
    thumbnailUrl: string | null;
    canvasWidth: number;
    canvasHeight: number;
    backgroundColor: string;
  }>,
  opts?: { userId?: string | null }
): Promise<AssetTemplate> {
  const supabase = await createClient();

  // Catch the draft→published transition so we can snapshot a version.
  let snapshotPublished = false;
  if (patch.status === "published") {
    const { data: prior } = await supabase
      .from("templates")
      .select("status")
      .eq("id", id)
      .single();
    snapshotPublished = !prior || prior.status !== "published";
  }

  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.category !== undefined) body.category = patch.category;
  if (patch.brandTokensId !== undefined) body.brand_tokens_id = patch.brandTokensId;
  if (patch.thumbnailUrl !== undefined) body.thumbnail_url = patch.thumbnailUrl;
  if (patch.canvasWidth !== undefined) body.canvas_width = patch.canvasWidth;
  if (patch.canvasHeight !== undefined) body.canvas_height = patch.canvasHeight;
  if (patch.backgroundColor !== undefined) body.background_color = patch.backgroundColor;

  const { data, error } = await supabase
    .from("templates")
    .update(body)
    .eq("id", id)
    .select("*, template_layers(*), template_output_specs(*), template_versions(*)")
    .single();
  if (error) throw error;

  // If this update crossed the publish boundary, freeze a new version.
  if (snapshotPublished) {
    await snapshotTemplateVersion(id, opts?.userId ?? null);
    const { data: refreshed } = await supabase
      .from("templates")
      .select("*, template_layers(*), template_output_specs(*), template_versions(*)")
      .eq("id", id)
      .single();
    if (refreshed) return toTemplate(refreshed);
  }

  return toTemplate(data);
}

// ─── Versioning ──────────────────────────────────────────────────────────────

/**
 * Freeze the current state of a template (layers + output specs + canvas
 * config) into a new `template_versions` row and set it as the template's
 * current_version_id. Version numbers auto-increment per template.
 *
 * Called automatically from updateTemplate when the status flips to
 * 'published', and exposed directly for explicit "Save as new version"
 * actions from the UI.
 */
export async function snapshotTemplateVersion(
  templateId: string,
  createdBy: string | null,
  opts?: { label?: string; notes?: string }
): Promise<TemplateVersion> {
  const supabase = await createClient();

  // Read current template state
  const { data: tmpl, error: tErr } = await supabase
    .from("templates")
    .select("*, template_layers(*), template_output_specs(*)")
    .eq("id", templateId)
    .single();
  if (tErr || !tmpl) throw tErr ?? new Error("Template not found");

  // Next version number
  const { data: latest } = await supabase
    .from("template_versions")
    .select("version")
    .eq("template_id", templateId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (latest?.[0]?.version ?? 0) + 1;

  const template = toTemplate(tmpl);
  const snapshot: TemplateVersionSnapshot = {
    template: {
      name: template.name,
      description: template.description,
      category: template.category,
      brandTokensId: template.brandTokensId,
      canvasWidth: template.canvasWidth,
      canvasHeight: template.canvasHeight,
      backgroundColor: template.backgroundColor,
    },
    layers: template.layers ?? [],
    outputSpecs: template.outputSpecs ?? [],
  };

  const { data: versionRow, error: vErr } = await supabase
    .from("template_versions")
    .insert({
      template_id: templateId,
      version: nextVersion,
      label: opts?.label ?? `v${nextVersion}`,
      notes: opts?.notes ?? "",
      snapshot,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (vErr) throw vErr;

  // Point template at its new current version
  await supabase
    .from("templates")
    .update({ current_version_id: versionRow.id })
    .eq("id", templateId);

  return toVersion(versionRow);
}

export async function listTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("template_versions")
    .select("*")
    .eq("template_id", templateId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toVersion);
}

export async function getTemplateVersion(id: string): Promise<TemplateVersion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("template_versions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return toVersion(data);
}

/**
 * Restore a template's layer tree + output specs from a prior version
 * snapshot. Creates a NEW version on restore so you can undo it; doesn't
 * mutate history. The template's `status` is left alone — the caller
 * decides whether to publish after restore.
 */
export async function restoreTemplateVersion(
  templateId: string,
  versionId: string,
  userId: string | null
): Promise<AssetTemplate> {
  const supabase = await createClient();
  const version = await getTemplateVersion(versionId);
  if (!version || version.templateId !== templateId) {
    throw new Error("Version not found for this template");
  }

  // Replace template metadata
  const tmplMeta = version.snapshot.template;
  await supabase
    .from("templates")
    .update({
      name: tmplMeta.name,
      description: tmplMeta.description,
      category: tmplMeta.category,
      brand_tokens_id: tmplMeta.brandTokensId,
      canvas_width: tmplMeta.canvasWidth,
      canvas_height: tmplMeta.canvasHeight,
      background_color: tmplMeta.backgroundColor,
    })
    .eq("id", templateId);

  // Replace layer tree
  await supabase.from("template_layers").delete().eq("template_id", templateId);
  if (version.snapshot.layers.length > 0) {
    await supabase.from("template_layers").insert(
      version.snapshot.layers.map((l) => ({
        template_id: templateId,
        name: l.name,
        layer_type: l.layerType,
        is_dynamic: l.isDynamic,
        is_locked: l.isLocked,
        data_binding: l.dataBinding,
        static_value: l.staticValue,
        x_pct: l.xPct,
        y_pct: l.yPct,
        width_pct: l.widthPct,
        height_pct: l.heightPct,
        rotation_deg: l.rotationDeg,
        z_index: l.zIndex,
        sort_order: l.sortOrder,
        props: l.props,
        locales: l.locales ?? {},
      }))
    );
  }

  // Replace output specs
  await supabase.from("template_output_specs").delete().eq("template_id", templateId);
  if (version.snapshot.outputSpecs.length > 0) {
    await supabase.from("template_output_specs").insert(
      version.snapshot.outputSpecs.map((s) => ({
        template_id: templateId,
        label: s.label,
        width: s.width,
        height: s.height,
        channel: s.channel,
        format: s.format,
        sort_order: s.sortOrder,
      }))
    );
  }

  // Snapshot the restored state as a new version (so restore is auditable).
  await snapshotTemplateVersion(templateId, userId, {
    label: `restored from v${version.version}`,
    notes: `Restored on ${new Date().toISOString()} from version ${version.version}`,
  });

  const refreshed = await getTemplate(templateId);
  if (!refreshed) throw new Error("Template not found after restore");
  return refreshed;
}

export async function deleteTemplate(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("templates").delete().eq("id", id);
  if (error) throw error;
}

// ─── Layers ──────────────────────────────────────────────────────────────────

export async function createLayer(input: {
  templateId: string;
  name: string;
  layerType: TemplateLayerType;
  isDynamic?: boolean;
  isLocked?: boolean;
  dataBinding?: string;
  staticValue?: string;
  xPct?: number;
  yPct?: number;
  widthPct?: number;
  heightPct?: number;
  rotationDeg?: number;
  zIndex?: number;
  sortOrder?: number;
  props?: TemplateLayerProps;
  locales?: Record<string, string>;
}): Promise<TemplateLayer> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("template_layers")
    .insert({
      template_id: input.templateId,
      name: input.name,
      layer_type: input.layerType,
      is_dynamic: input.isDynamic ?? false,
      is_locked: input.isLocked ?? false,
      data_binding: input.dataBinding ?? "",
      static_value: input.staticValue ?? "",
      x_pct: input.xPct ?? 0,
      y_pct: input.yPct ?? 0,
      width_pct: input.widthPct ?? 100,
      height_pct: input.heightPct ?? 100,
      rotation_deg: input.rotationDeg ?? 0,
      z_index: input.zIndex ?? 0,
      sort_order: input.sortOrder ?? 0,
      props: input.props ?? {},
      locales: input.locales ?? {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return toLayer(data);
}

export async function updateLayer(
  id: string,
  patch: Partial<{
    name: string;
    layerType: TemplateLayerType;
    isDynamic: boolean;
    isLocked: boolean;
    dataBinding: string;
    staticValue: string;
    xPct: number;
    yPct: number;
    widthPct: number;
    heightPct: number;
    rotationDeg: number;
    zIndex: number;
    sortOrder: number;
    props: TemplateLayerProps;
    locales: Record<string, string>;
  }>
): Promise<TemplateLayer> {
  const supabase = await createClient();
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.layerType !== undefined) body.layer_type = patch.layerType;
  if (patch.isDynamic !== undefined) body.is_dynamic = patch.isDynamic;
  if (patch.isLocked !== undefined) body.is_locked = patch.isLocked;
  if (patch.dataBinding !== undefined) body.data_binding = patch.dataBinding;
  if (patch.staticValue !== undefined) body.static_value = patch.staticValue;
  if (patch.xPct !== undefined) body.x_pct = patch.xPct;
  if (patch.yPct !== undefined) body.y_pct = patch.yPct;
  if (patch.widthPct !== undefined) body.width_pct = patch.widthPct;
  if (patch.heightPct !== undefined) body.height_pct = patch.heightPct;
  if (patch.rotationDeg !== undefined) body.rotation_deg = patch.rotationDeg;
  if (patch.zIndex !== undefined) body.z_index = patch.zIndex;
  if (patch.sortOrder !== undefined) body.sort_order = patch.sortOrder;
  if (patch.props !== undefined) body.props = patch.props;
  if (patch.locales !== undefined) body.locales = patch.locales;
  const { data, error } = await supabase
    .from("template_layers")
    .update(body)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return toLayer(data);
}

export async function deleteLayer(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("template_layers").delete().eq("id", id);
  if (error) throw error;
}

// ─── Output Specs ────────────────────────────────────────────────────────────

export async function createOutputSpec(input: {
  templateId: string;
  label: string;
  width: number;
  height: number;
  channel?: string;
  format?: "png" | "jpg" | "webp";
  sortOrder?: number;
}): Promise<TemplateOutputSpec> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("template_output_specs")
    .insert({
      template_id: input.templateId,
      label: input.label,
      width: input.width,
      height: input.height,
      channel: input.channel ?? "",
      format: input.format ?? "png",
      sort_order: input.sortOrder ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toOutputSpec(data);
}

export async function deleteOutputSpec(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("template_output_specs").delete().eq("id", id);
  if (error) throw error;
}

/** Convenience helper: ensure a template has the three default Storyteq sizes. */
export const DEFAULT_OUTPUT_SPECS: Array<{
  label: string;
  width: number;
  height: number;
  channel: string;
  sortOrder: number;
}> = [
  { label: "Square 1:1",      width: 1080, height: 1080, channel: "Social",    sortOrder: 0 },
  { label: "Portrait 4:5",    width: 1080, height: 1350, channel: "Social",    sortOrder: 1 },
  { label: "Story 9:16",      width: 1080, height: 1920, channel: "Story/Reel", sortOrder: 2 },
];

export async function ensureDefaultOutputSpecs(templateId: string): Promise<TemplateOutputSpec[]> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("template_output_specs")
    .select("label")
    .eq("template_id", templateId);
  const have = new Set((existing ?? []).map((r) => r.label as string));
  const toInsert = DEFAULT_OUTPUT_SPECS.filter((s) => !have.has(s.label)).map((s) => ({
    template_id: templateId,
    label: s.label,
    width: s.width,
    height: s.height,
    channel: s.channel,
    format: "png" as const,
    sort_order: s.sortOrder,
  }));
  if (toInsert.length === 0) return [];
  const { data, error } = await supabase
    .from("template_output_specs")
    .insert(toInsert)
    .select("*");
  if (error) throw error;
  return (data ?? []).map(toOutputSpec);
}
