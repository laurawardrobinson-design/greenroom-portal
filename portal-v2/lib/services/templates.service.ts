import { createClient } from "@/lib/supabase/server";
import type {
  AssetTemplate,
  TemplateLayer,
  TemplateLayerProps,
  TemplateLayerType,
  TemplateOutputSpec,
  TemplateStatus,
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
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    layers,
    outputSpecs,
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
  const { data, error } = await supabase
    .from("templates")
    .select("*, template_layers(*), template_output_specs(*)")
    .eq("id", id)
    .single();
  if (error) return null;
  return toTemplate(data);
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
  }>
): Promise<AssetTemplate> {
  const supabase = await createClient();
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
    .select("*, template_layers(*), template_output_specs(*)")
    .single();
  if (error) throw error;
  return toTemplate(data);
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
