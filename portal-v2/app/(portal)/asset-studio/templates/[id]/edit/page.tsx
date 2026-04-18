"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import type {
  AssetTemplate,
  TemplateLayer,
  TemplateLayerType,
  TemplateOutputSpec,
  TemplateStatus,
} from "@/types/domain";
import { fetcher, statusPillClass } from "@/components/asset-studio/lib";
import {
  ArrowLeft,
  Trash2,
  Lock,
  Unlock,
  Type as TypeIcon,
  Image as ImageIcon,
  Square as ShapeIcon,
  ImagePlus,
  Layers,
  Save,
} from "lucide-react";

const ALLOWED_ROLES = ["Admin", "Producer", "Post Producer", "Designer"];

const LAYER_ICONS: Record<TemplateLayerType, React.ElementType> = {
  text: TypeIcon,
  image: ImageIcon,
  logo: ImagePlus,
  shape: ShapeIcon,
};

export default function TemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, isLoading: userLoading } = useCurrentUser();
  const url = `/api/asset-studio/templates/${id}`;
  const { data, isLoading, error } = useSWR<AssetTemplate>(url, fetcher);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  if (userLoading || !user) return <DashboardSkeleton />;
  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <EmptyState
        title="Access restricted"
        description="You don't have permission to edit templates."
      />
    );
  }

  if (isLoading) return <DashboardSkeleton />;
  if (error || !data) {
    return (
      <EmptyState
        title="Template not found"
        description="It may have been deleted."
      />
    );
  }

  const layers = (data.layers ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null;

  return (
    <div className="space-y-4" data-area="asset-studio">
      <TemplateHeader template={data} mutateUrl={url} />

      <div className="grid grid-cols-12 gap-4">
        {/* Left: layer tree */}
        <div className="col-span-12 lg:col-span-3">
          <LayerTree
            templateId={id}
            layers={layers}
            selectedId={selectedLayerId}
            onSelect={setSelectedLayerId}
            mutateUrl={url}
          />
        </div>

        {/* Center: canvas preview */}
        <div className="col-span-12 lg:col-span-6">
          <CanvasPreview
            template={data}
            layers={layers}
            selectedId={selectedLayerId}
            onSelect={setSelectedLayerId}
          />
        </div>

        {/* Right: properties + output specs */}
        <div className="col-span-12 space-y-4 lg:col-span-3">
          <PropertiesPanel layer={selectedLayer} mutateUrl={url} />
          <OutputSpecsPanel template={data} mutateUrl={url} />
        </div>
      </div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function TemplateHeader({
  template,
  mutateUrl,
}: {
  template: AssetTemplate;
  mutateUrl: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(template.name);
  const [status, setStatus] = useState<TemplateStatus>(template.status);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/asset-studio/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, status }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast("success", "Template saved");
      mutate(mutateUrl);
    } catch (err) {
      console.error(err);
      toast("error", "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--as-border)] bg-[var(--as-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-3">
        <button
          onClick={() => router.push("/asset-studio?tab=templates")}
          className="rounded-md p-1.5 text-[var(--as-text-muted)] hover:bg-[var(--as-surface-2)]"
          aria-label="Back to templates"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-md font-semibold"
        />
        <span className={statusPillClass(status)}>{status}</span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TemplateStatus)}
          className="rounded-md border border-[var(--as-border)] bg-[var(--as-surface)] px-2 py-1.5 text-xs"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <Button size="sm" onClick={save} loading={busy}>
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
        <Link href={`/asset-studio/runs/new?templateId=${template.id}`}>
          <Button size="sm" variant="outline">
            New run
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Layer tree ──────────────────────────────────────────────────────────────

function LayerTree({
  templateId,
  layers,
  selectedId,
  onSelect,
  mutateUrl,
}: {
  templateId: string;
  layers: TemplateLayer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  mutateUrl: string;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);

  async function addLayer(layerType: TemplateLayerType) {
    setAdding(true);
    try {
      const res = await fetch(`/api/asset-studio/templates/${templateId}/layers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${layerType} ${layers.length + 1}`,
          layerType,
          xPct: 10,
          yPct: 10,
          widthPct: 80,
          heightPct: layerType === "text" ? 12 : 60,
          sortOrder: layers.length,
          zIndex: layers.length,
          isDynamic: layerType === "image" || layerType === "text",
          dataBinding:
            layerType === "image"
              ? "product.image_url"
              : layerType === "text"
                ? "product.name"
                : "",
          staticValue: layerType === "logo" ? "/greenroom-logo.png" : "",
          isLocked: layerType === "logo",
          props:
            layerType === "text"
              ? { font_size: 48, font_weight: 700, align: "center", color: "#1F1F1F" }
              : layerType === "shape"
                ? { color: "#69A925", radius: 12 }
                : layerType === "image" || layerType === "logo"
                  ? { fit: "contain" }
                  : {},
        }),
      });
      if (!res.ok) throw new Error("Failed to add layer");
      const created = (await res.json()) as TemplateLayer;
      mutate(mutateUrl);
      onSelect(created.id);
    } catch (err) {
      console.error(err);
      toast("error", "Couldn't add layer");
    } finally {
      setAdding(false);
    }
  }

  async function deleteLayer(id: string) {
    if (!window.confirm("Delete this layer?")) return;
    try {
      const res = await fetch(
        `/api/asset-studio/templates/${templateId}/layers/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      if (selectedId === id) onSelect(null);
      mutate(mutateUrl);
    } catch {
      toast("error", "Couldn't delete layer");
    }
  }

  return (
    <div className="rounded-xl border border-[var(--as-border)] bg-[var(--as-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--as-border)] px-3 py-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[var(--as-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--as-text)]">Layers</h3>
        </div>
        <span className="text-xs text-[var(--as-text-subtle)]">{layers.length}</span>
      </div>

      {layers.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-[var(--as-text-muted)]">
          No layers yet. Add one below.
        </p>
      ) : (
        <ul className="max-h-72 overflow-y-auto py-1">
          {layers.map((l) => {
            const Icon = LAYER_ICONS[l.layerType];
            const isSelected = l.id === selectedId;
            return (
              <li key={l.id}>
                <button
                  onClick={() => onSelect(l.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                    isSelected
                      ? "bg-[var(--as-layer-active)] text-[var(--as-text)]"
                      : "text-[var(--as-text)] hover:bg-[var(--as-layer-hover)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--as-text-muted)]" />
                  <span className="flex-1 truncate">{l.name}</span>
                  {l.isLocked && (
                    <Lock className="h-3 w-3 text-[var(--as-handle-locked)]" />
                  )}
                  {l.isDynamic && (
                    <span className="rounded bg-[var(--as-accent-soft)] px-1 text-[10px] font-medium text-[var(--as-accent)]">
                      dyn
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLayer(l.id);
                    }}
                    className="rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--as-surface-2)] group-hover:opacity-100"
                    aria-label="Delete layer"
                  >
                    <Trash2 className="h-3 w-3 text-[var(--as-text-subtle)]" />
                  </button>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-[var(--as-border)] p-2">
        <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-[var(--as-text-subtle)]">
          Add layer
        </p>
        <div className="grid grid-cols-2 gap-1">
          {(["text", "image", "logo", "shape"] as TemplateLayerType[]).map((t) => {
            const Icon = LAYER_ICONS[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => addLayer(t)}
                disabled={adding}
                className="flex items-center justify-center gap-1.5 rounded-md border border-[var(--as-border)] bg-[var(--as-surface)] px-2 py-1.5 text-xs font-medium text-[var(--as-text)] transition-colors hover:bg-[var(--as-layer-hover)] disabled:opacity-50"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="capitalize">{t}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Canvas preview ──────────────────────────────────────────────────────────

function CanvasPreview({
  template,
  layers,
  selectedId,
  onSelect,
}: {
  template: AssetTemplate;
  layers: TemplateLayer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  // Canvas fills whatever width its parent column grants it (up to 640px),
  // and preserves the template aspect via CSS `aspect-ratio`. Layer
  // positions are already percentage-based so they scale automatically.
  // Hard-pinning a pixel width pushed the whole grid off at ~1280px
  // viewports and clipped the right-hand Properties panel.
  const aspectRatio = `${template.canvasWidth} / ${template.canvasHeight}`;

  return (
    <div className="rounded-xl border border-[var(--as-border)] bg-[var(--as-canvas-bg)] p-6">
      <div className="mx-auto w-full max-w-[640px]">
        <div
          className="relative w-full overflow-hidden rounded shadow-lg"
          style={{
            aspectRatio,
            background: template.backgroundColor || "#FFFFFF",
          }}
          onClick={() => onSelect(null)}
        >
          {layers.map((l) => {
            const isSelected = l.id === selectedId;
            return (
              <button
                key={l.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(l.id);
                }}
                className={`absolute flex items-center justify-center overflow-hidden border-2 text-[10px] font-medium transition-all ${
                  isSelected
                    ? "border-[var(--as-handle-color)] bg-[var(--as-accent-soft)]/60"
                    : l.isLocked
                      ? "border-[var(--as-handle-locked)]/40 hover:border-[var(--as-handle-locked)]"
                      : "border-white/40 hover:border-white/80"
                }`}
                style={{
                  left: `${l.xPct}%`,
                  top: `${l.yPct}%`,
                  width: `${l.widthPct}%`,
                  height: `${l.heightPct}%`,
                }}
                aria-label={`Select layer ${l.name}`}
              >
                <span
                  className={`max-w-full truncate px-1 text-center ${
                    isSelected
                      ? "text-[var(--as-text)]"
                      : "text-white/90"
                  }`}
                >
                  {l.layerType === "text" || l.layerType === "logo"
                    ? l.isDynamic
                      ? `{{${l.dataBinding}}}`
                      : l.staticValue || l.name
                    : l.name}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs text-white/50">
          {template.canvasWidth} × {template.canvasHeight}px · fits to column
        </p>
      </div>
    </div>
  );
}

// ─── Properties panel ────────────────────────────────────────────────────────

function PropertiesPanel({
  layer,
  mutateUrl,
}: {
  layer: TemplateLayer | null;
  mutateUrl: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!layer) {
    return (
      <div className="rounded-xl border border-[var(--as-border)] bg-[var(--as-surface)] p-4">
        <p className="text-xs text-[var(--as-text-muted)]">
          Select a layer to edit its properties.
        </p>
      </div>
    );
  }

  async function patch(patch: Record<string, unknown>) {
    if (!layer) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/asset-studio/templates/${layer.templateId}/layers/${layer.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      if (!res.ok) throw new Error();
      mutate(mutateUrl);
    } catch {
      toast("error", "Couldn't update layer");
    } finally {
      setBusy(false);
    }
  }

  const isText = layer.layerType === "text";
  const isImage = layer.layerType === "image" || layer.layerType === "logo";

  return (
    <div className="space-y-3 rounded-xl border border-[var(--as-border)] bg-[var(--as-surface)] p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--as-text)]">Properties</h3>
        <button
          type="button"
          onClick={() => patch({ isLocked: !layer.isLocked })}
          className="rounded p-1 text-[var(--as-text-muted)] hover:bg-[var(--as-surface-2)]"
          aria-label={layer.isLocked ? "Unlock" : "Lock"}
        >
          {layer.isLocked ? (
            <Lock className="h-4 w-4 text-[var(--as-handle-locked)]" />
          ) : (
            <Unlock className="h-4 w-4" />
          )}
        </button>
      </div>

      <Field label="Name">
        <Input
          value={layer.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </Field>

      <label className="flex items-center justify-between gap-2 rounded-md border border-[var(--as-border)] bg-[var(--as-surface-2)] px-2.5 py-2 text-xs">
        <span className="font-medium text-[var(--as-text)]">Dynamic value</span>
        <input
          type="checkbox"
          checked={layer.isDynamic}
          onChange={(e) => patch({ isDynamic: e.target.checked })}
          className="h-4 w-4 accent-[var(--as-accent)]"
        />
      </label>

      {layer.isDynamic ? (
        <Field label="Data binding" hint="e.g. product.name, product.image_url, product.price">
          <Input
            value={layer.dataBinding}
            onChange={(e) => patch({ dataBinding: e.target.value })}
            placeholder="product.name"
          />
        </Field>
      ) : (
        <Field label={isText ? "Text content" : "URL"}>
          <Input
            value={layer.staticValue}
            onChange={(e) => patch({ staticValue: e.target.value })}
            placeholder={isText ? "Type text…" : "/path/to/image.png"}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="X (%)">
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={layer.xPct}
            onChange={(e) => patch({ xPct: Number(e.target.value) })}
          />
        </Field>
        <Field label="Y (%)">
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={layer.yPct}
            onChange={(e) => patch({ yPct: Number(e.target.value) })}
          />
        </Field>
        <Field label="W (%)">
          <Input
            type="number"
            min={1}
            max={100}
            step={0.5}
            value={layer.widthPct}
            onChange={(e) => patch({ widthPct: Number(e.target.value) })}
          />
        </Field>
        <Field label="H (%)">
          <Input
            type="number"
            min={1}
            max={100}
            step={0.5}
            value={layer.heightPct}
            onChange={(e) => patch({ heightPct: Number(e.target.value) })}
          />
        </Field>
      </div>

      {isText && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Font size">
              <Input
                type="number"
                min={8}
                max={400}
                value={Number(layer.props?.font_size) || 48}
                onChange={(e) =>
                  patch({
                    props: { ...layer.props, font_size: Number(e.target.value) },
                  })
                }
              />
            </Field>
            <Field label="Font weight">
              <Input
                type="number"
                min={100}
                max={900}
                step={100}
                value={Number(layer.props?.font_weight) || 600}
                onChange={(e) =>
                  patch({
                    props: { ...layer.props, font_weight: Number(e.target.value) },
                  })
                }
              />
            </Field>
          </div>
          <Field label="Color">
            <Input
              value={String(layer.props?.color ?? "#1F1F1F")}
              onChange={(e) =>
                patch({ props: { ...layer.props, color: e.target.value } })
              }
            />
          </Field>
          <Field label="Align">
            <select
              value={String(layer.props?.align ?? "center")}
              onChange={(e) =>
                patch({ props: { ...layer.props, align: e.target.value } })
              }
              className="block w-full rounded-lg border border-[var(--as-border)] bg-[var(--as-surface)] px-3 py-2 text-sm"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </Field>
        </>
      )}

      {isImage && (
        <Field label="Fit">
          <select
            value={String(layer.props?.fit ?? "cover")}
            onChange={(e) =>
              patch({ props: { ...layer.props, fit: e.target.value } })
            }
            className="block w-full rounded-lg border border-[var(--as-border)] bg-[var(--as-surface)] px-3 py-2 text-sm"
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="fill">Fill</option>
          </select>
        </Field>
      )}

      {busy && (
        <p className="text-[11px] text-[var(--as-text-subtle)]">Saving…</p>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--as-text-muted)]">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11px] text-[var(--as-text-subtle)]">{hint}</p>
      )}
    </div>
  );
}

// ─── Output specs panel ──────────────────────────────────────────────────────

function OutputSpecsPanel({
  template,
  mutateUrl,
}: {
  template: AssetTemplate;
  mutateUrl: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const specs = (template.outputSpecs ?? []) as TemplateOutputSpec[];

  async function ensureDefaults() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/asset-studio/templates/${template.id}/output-specs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ensureDefaults: true }),
        }
      );
      if (!res.ok) throw new Error();
      mutate(mutateUrl);
    } catch {
      toast("error", "Couldn't ensure defaults");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSpec(specId: string) {
    if (!window.confirm("Delete this output size?")) return;
    try {
      const res = await fetch(
        `/api/asset-studio/templates/${template.id}/output-specs/${specId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      mutate(mutateUrl);
    } catch {
      toast("error", "Couldn't delete spec");
    }
  }

  return (
    <div className="rounded-xl border border-[var(--as-border)] bg-[var(--as-surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--as-text)]">Output sizes</h3>
        <button
          type="button"
          onClick={ensureDefaults}
          disabled={busy}
          className="text-xs font-medium text-[var(--as-accent)] hover:text-[var(--as-accent-hover)]"
        >
          + Defaults
        </button>
      </div>
      {specs.length === 0 ? (
        <p className="text-xs text-[var(--as-text-muted)]">
          No output sizes. Add the Storyteq defaults to get 1:1, 4:5, and 9:16.
        </p>
      ) : (
        <ul className="space-y-1">
          {specs.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-md border border-[var(--as-border)] bg-[var(--as-surface-2)] px-2 py-1.5 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--as-text)]">{s.label}</p>
                <p className="text-[11px] text-[var(--as-text-subtle)]">
                  {s.width}×{s.height} · {s.format.toUpperCase()}
                  {s.channel ? ` · ${s.channel}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteSpec(s.id)}
                className="rounded p-1 text-[var(--as-text-subtle)] hover:bg-[var(--as-surface)] hover:text-[var(--as-status-failed)]"
                aria-label="Delete output size"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
