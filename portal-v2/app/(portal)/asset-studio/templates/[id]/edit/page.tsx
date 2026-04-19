"use client";

import React, { use, useCallback, useEffect, useRef, useState } from "react";
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
  Maximize2,
  Minimize2,
  Type as TypeIcon,
  Image as ImageIcon,
  Square as ShapeIcon,
  ImagePlus,
  Layers,
  Save,
  Upload,
  History,
  Eye,
  X,
  Languages,
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
    <TemplateEditShell
      template={data}
      url={url}
      layers={layers}
      selectedLayer={selectedLayer}
      selectedLayerId={selectedLayerId}
      setSelectedLayerId={setSelectedLayerId}
      templateId={id}
    />
  );
}

// Separated shell so we can mount `fixed inset-0` wrapper when the designer
// flips into fullscreen. Same layout either way — the wrapper just decides
// whether the app chrome (sidebar + topbar + page padding) is covered.
function TemplateEditShell({
  template,
  url,
  layers,
  selectedLayer,
  selectedLayerId,
  setSelectedLayerId,
  templateId,
}: {
  template: AssetTemplate;
  url: string;
  layers: TemplateLayer[];
  selectedLayer: TemplateLayer | null;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  templateId: string;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Escape exits fullscreen. Cmd/Ctrl+. toggles it — keeping it off common
  // browser shortcuts so we don't fight Cmd+F (find) or F11 (browser FS).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setIsFullscreen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const content = (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 overflow-y-auto bg-[var(--as-canvas-bg)] p-4"
          : "space-y-4"
      }
      data-area="asset-studio"
    >
      <div className={isFullscreen ? "space-y-4" : ""}>
        <TemplateHeader
          template={template}
          mutateUrl={url}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((v) => !v)}
        />

        <div className="grid grid-cols-12 gap-4">
          {/* Left: layer tree */}
          <div className="col-span-12 lg:col-span-3">
            <LayerTree
              templateId={templateId}
              layers={layers}
              selectedId={selectedLayerId}
              onSelect={setSelectedLayerId}
              mutateUrl={url}
            />
          </div>

          {/* Center: canvas preview */}
          <div className="col-span-12 lg:col-span-6">
            <CanvasPreview
              template={template}
              layers={layers}
              selectedId={selectedLayerId}
              onSelect={setSelectedLayerId}
              mutateUrl={url}
            />
          </div>

          {/* Right: properties + output specs */}
          <div className="col-span-12 space-y-4 lg:col-span-3">
            <PropertiesPanel layer={selectedLayer} mutateUrl={url} />
            <OutputSpecsPanel template={template} mutateUrl={url} />
          </div>
        </div>
      </div>
    </div>
  );

  return content;
}

// ─── Header ──────────────────────────────────────────────────────────────────

function TemplateHeader({
  template,
  mutateUrl,
  isFullscreen,
  onToggleFullscreen,
}: {
  template: AssetTemplate;
  mutateUrl: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
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
        <PreviewButton templateId={template.id} outputSpecs={template.outputSpecs ?? []} />
        <VersionHistoryButton template={template} mutateUrl={mutateUrl} />
        <Link href={`/asset-studio/runs/new?templateId=${template.id}`}>
          <Button size="sm" variant="outline">
            New run
          </Button>
        </Link>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--as-border)] bg-[var(--as-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--as-text-muted)] transition-colors hover:bg-[var(--as-surface-2)] hover:text-[var(--as-text)]"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          title={
            isFullscreen
              ? "Exit fullscreen (Esc or \u2318.)"
              : "Fullscreen (\u2318.)"
          }
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {isFullscreen ? "Exit" : "Fullscreen"}
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── Live preview ────────────────────────────────────────────────────────────

function PreviewButton({
  templateId,
  outputSpecs,
}: {
  templateId: string;
  outputSpecs: TemplateOutputSpec[];
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [specId, setSpecId] = useState<string>(outputSpecs[0]?.id ?? "");

  async function render(sid: string) {
    setBusy(true);
    setImageUrl(null);
    try {
      const res = await fetch(`/api/asset-studio/templates/${templateId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specId: sid || undefined }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      setImageUrl(URL.createObjectURL(blob));
    } catch {
      toast("error", "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function openAndRender() {
    setOpen(true);
    await render(specId);
  }

  // Release the object URL on close so we don't leak memory.
  useEffect(() => {
    if (!open && imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl(null);
    }
  }, [open, imageUrl]);

  return (
    <>
      <button
        type="button"
        onClick={openAndRender}
        disabled={outputSpecs.length === 0}
        title={outputSpecs.length === 0 ? "Add an output size first" : "Render a live preview"}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--as-border)] bg-[var(--as-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--as-text-muted)] transition-colors hover:bg-[var(--as-surface-2)] hover:text-[var(--as-text)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Eye className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Preview</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-lg bg-[var(--as-surface)] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--as-text)]">
                Live preview
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={specId}
                  onChange={(e) => {
                    setSpecId(e.target.value);
                    void render(e.target.value);
                  }}
                  className="rounded-md border border-[var(--as-border)] bg-[var(--as-surface)] px-2 py-1 text-xs"
                >
                  {outputSpecs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} · {s.width}×{s.height} · {s.format.toUpperCase()}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1.5 text-[var(--as-text-muted)] hover:bg-[var(--as-surface-2)]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex min-h-[320px] flex-1 items-center justify-center overflow-auto rounded-md bg-[var(--as-canvas-bg)] p-4">
              {busy ? (
                <p className="text-sm text-white/70">Rendering…</p>
              ) : imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="Template preview"
                  className="max-h-[70vh] max-w-full object-contain shadow-lg"
                />
              ) : (
                <p className="text-sm text-white/70">No preview yet</p>
              )}
            </div>
            <p className="text-[11px] text-[var(--as-text-subtle)]">
              Uses the first campaign-linked product as live data. Real runs use
              the full per-product fan-out.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Version history ─────────────────────────────────────────────────────────

function VersionHistoryButton({
  template,
  mutateUrl,
}: {
  template: AssetTemplate;
  mutateUrl: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const versions = (template.versions ?? []).slice().sort((a, b) => b.version - a.version);
  const current = versions.find((v) => v.id === template.currentVersionId);

  async function snapshot() {
    const label = window.prompt("Label for this version (optional):") ?? "";
    setBusy(true);
    try {
      const res = await fetch(`/api/asset-studio/templates/${template.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error();
      toast("success", "New version saved");
      await mutate(mutateUrl);
    } catch {
      toast("error", "Couldn't save version");
    } finally {
      setBusy(false);
    }
  }

  async function restore(versionId: string, versionLabel: string) {
    if (
      !window.confirm(
        `Restore to ${versionLabel}? Current edits become a new version first so nothing is lost.`
      )
    )
      return;
    setBusy(true);
    try {
      // Snapshot current state first so the restore is reversible.
      await fetch(`/api/asset-studio/templates/${template.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "pre-restore autosave" }),
      });
      const res = await fetch(
        `/api/asset-studio/templates/${template.id}/versions/${versionId}/restore`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error();
      toast("success", `Restored from ${versionLabel}`);
      await mutate(mutateUrl);
      setOpen(false);
    } catch {
      toast("error", "Couldn't restore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--as-border)] bg-[var(--as-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--as-text-muted)] transition-colors hover:bg-[var(--as-surface-2)] hover:text-[var(--as-text)] disabled:opacity-50"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <History className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">
          {current ? current.label || `v${current.version}` : "No versions"}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-[var(--as-border)] bg-[var(--as-surface)] p-2 shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--as-border)] px-2 pb-2">
            <span className="text-xs font-semibold text-[var(--as-text)]">
              Version history
            </span>
            <button
              type="button"
              onClick={snapshot}
              disabled={busy}
              className="text-xs font-medium text-[var(--as-accent)] hover:text-[var(--as-accent-hover)]"
            >
              + Save as new
            </button>
          </div>
          {versions.length === 0 ? (
            <p className="p-3 text-center text-xs text-[var(--as-text-muted)]">
              No versions yet. Publishing creates the first one.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {versions.map((v) => {
                const isCurrent = v.id === template.currentVersionId;
                return (
                  <li key={v.id} className="border-b border-[var(--as-border)] last:border-0">
                    <div className="flex items-center justify-between gap-2 px-2 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-[var(--as-text)]">
                            v{v.version}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full bg-[var(--as-accent-soft)] px-1.5 text-[10px] font-medium text-[var(--as-accent)]">
                              current
                            </span>
                          )}
                          {v.label && v.label !== `v${v.version}` && (
                            <span className="truncate text-[var(--as-text-muted)]">
                              — {v.label}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--as-text-subtle)]">
                          {new Date(v.createdAt).toLocaleString()}
                        </div>
                      </div>
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => restore(v.id, v.label || `v${v.version}`)}
                          disabled={busy}
                          className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--as-accent)] hover:bg-[var(--as-accent-soft)] disabled:opacity-50"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
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
  mutateUrl,
}: {
  template: AssetTemplate;
  layers: TemplateLayer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  mutateUrl: string;
}) {
  // Canvas fills whatever width its parent column grants it (up to 640px),
  // and preserves the template aspect via CSS `aspect-ratio`. Layer
  // positions are already percentage-based so they scale automatically.
  const aspectRatio = `${template.canvasWidth} / ${template.canvasHeight}`;
  const { toast } = useToast();

  // Drag-to-reposition state. `drag` tracks the active drag; `overrides`
  // mirrors the optimistic xPct/yPct for the layer being dragged so the
  // render stays in sync with the pointer. We PATCH on pointer-up.
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{
    layerId: string;
    startX: number;
    startY: number;
    origXPct: number;
    origYPct: number;
  } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, { xPct: number; yPct: number }>>({});

  const onPointerDownLayer = useCallback(
    (e: React.PointerEvent, l: TemplateLayer) => {
      if (l.isLocked) return;
      e.stopPropagation();
      e.preventDefault();
      onSelect(l.id);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({
        layerId: l.id,
        startX: e.clientX,
        startY: e.clientY,
        origXPct: l.xPct,
        origYPct: l.yPct,
      });
    },
    [onSelect]
  );

  const onPointerMoveLayer = useCallback(
    (e: React.PointerEvent) => {
      if (!drag || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;
      const nextX = Math.max(0, Math.min(100, drag.origXPct + dxPct));
      const nextY = Math.max(0, Math.min(100, drag.origYPct + dyPct));
      setOverrides((o) => ({ ...o, [drag.layerId]: { xPct: nextX, yPct: nextY } }));
    },
    [drag]
  );

  const onPointerUpLayer = useCallback(
    async (e: React.PointerEvent) => {
      if (!drag) return;
      const override = overrides[drag.layerId];
      setDrag(null);
      if (!override) return;
      // Round to one decimal place — the numeric inputs step by 0.5 so tight
      // precision is unnecessary and makes the DB row noisy.
      const xPct = Math.round(override.xPct * 10) / 10;
      const yPct = Math.round(override.yPct * 10) / 10;
      try {
        const res = await fetch(
          `/api/asset-studio/templates/${template.id}/layers/${drag.layerId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ xPct, yPct }),
          }
        );
        if (!res.ok) throw new Error();
        await mutate(mutateUrl);
        setOverrides((o) => {
          const { [drag.layerId]: _, ...rest } = o;
          return rest;
        });
      } catch {
        toast("error", "Couldn't save position");
        setOverrides((o) => {
          const { [drag.layerId]: _, ...rest } = o;
          return rest;
        });
      }
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    },
    [drag, overrides, template.id, mutateUrl, toast]
  );

  return (
    <div className="rounded-xl border border-[var(--as-border)] bg-[var(--as-canvas-bg)] p-6">
      <div className="mx-auto w-full max-w-[640px]">
        <div
          ref={canvasRef}
          className="relative w-full overflow-hidden rounded shadow-lg select-none"
          style={{
            aspectRatio,
            background: template.backgroundColor || "#FFFFFF",
          }}
          onClick={() => onSelect(null)}
        >
          {layers.map((l) => {
            const isSelected = l.id === selectedId;
            const o = overrides[l.id];
            const x = o ? o.xPct : l.xPct;
            const y = o ? o.yPct : l.yPct;
            return (
              <button
                key={l.id}
                type="button"
                onPointerDown={(e) => onPointerDownLayer(e, l)}
                onPointerMove={onPointerMoveLayer}
                onPointerUp={onPointerUpLayer}
                onPointerCancel={onPointerUpLayer}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(l.id);
                }}
                className={`absolute flex items-center justify-center overflow-hidden border-2 text-[10px] font-medium transition-all ${
                  l.isLocked ? "cursor-not-allowed" : "cursor-move"
                } ${
                  isSelected
                    ? "border-[var(--as-handle-color)] bg-[var(--as-accent-soft)]/60"
                    : l.isLocked
                      ? "border-[var(--as-handle-locked)]/40 hover:border-[var(--as-handle-locked)]"
                      : "border-white/40 hover:border-white/80"
                }`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${l.widthPct}%`,
                  height: `${l.heightPct}%`,
                  touchAction: "none",
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
          {template.canvasWidth} × {template.canvasHeight}px · drag to reposition
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
      ) : isText ? (
        <>
          <Field label="Text content">
            <Input
              value={layer.staticValue}
              onChange={(e) => patch({ staticValue: e.target.value })}
              placeholder="Type text…"
            />
          </Field>
          <TextLayerTranslations layer={layer} patch={patch} />
        </>
      ) : (
        <Field label="Source">
          <AssetUrlInput
            value={layer.staticValue}
            onChange={(next) => patch({ staticValue: next })}
            layerType={layer.layerType}
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
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={String(layer.props?.color ?? "#1F1F1F")}
                onChange={(e) =>
                  patch({ props: { ...layer.props, color: e.target.value } })
                }
                className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-[var(--as-border)] bg-[var(--as-surface)] p-0.5"
                aria-label="Pick color"
              />
              <Input
                value={String(layer.props?.color ?? "#1F1F1F")}
                onChange={(e) =>
                  patch({ props: { ...layer.props, color: e.target.value } })
                }
                className="flex-1 font-mono text-xs"
              />
            </div>
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

// Combined URL + upload input for image / logo layer sources. Lets the
// designer paste a URL or upload a file; on successful upload we flip
// the field to the returned public URL.
function AssetUrlInput({
  value,
  onChange,
  layerType,
}: {
  value: string;
  onChange: (next: string) => void;
  layerType: TemplateLayerType;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", "brand-assets");
      fd.append("prefix", layerType === "logo" ? "logos" : "images");
      const res = await fetch("/api/asset-studio/uploads", {
        method: "POST",
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      onChange(body.publicUrl);
      toast("success", "Uploaded");
    } catch (err) {
      toast("error", (err as Error).message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="layer asset preview"
          className="h-16 w-full rounded border border-[var(--as-border)] bg-[var(--as-surface-2)] object-contain p-1"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      ) : null}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/path/to/image.png or paste URL"
      />
      <label
        className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--as-border)] bg-[var(--as-surface-2)] px-2 py-1.5 text-xs font-medium text-[var(--as-text-muted)] transition-colors hover:bg-[var(--as-layer-hover)] hover:text-[var(--as-text)] ${
          uploading ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <Upload className="h-3.5 w-3.5" />
        {uploading ? "Uploading…" : "Upload file"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
      </label>
    </div>
  );
}

// List of locales available to Publix for the demo. Widen later or drive from
// a per-template setting. "en-US" is the default that every layer.staticValue
// implicitly speaks; we don't render it as a row here.
const AVAILABLE_LOCALES = [
  { code: "es-US", label: "Spanish (US)" },
  { code: "fr-CA", label: "French (Canada)" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
] as const;

function TextLayerTranslations({
  layer,
  patch,
}: {
  layer: TemplateLayer;
  patch: (p: Partial<TemplateLayer>) => void;
}) {
  const [open, setOpen] = React.useState(
    Object.keys(layer.locales ?? {}).length > 0
  );
  const locales = layer.locales ?? {};
  const activeCount = Object.values(locales).filter((v) => v?.trim()).length;
  return (
    <div className="rounded-md border border-dashed border-[var(--as-border)] p-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left text-[11px] font-medium uppercase tracking-wide text-[var(--as-text-muted)]"
      >
        <span className="flex items-center gap-1.5">
          <Languages className="h-3 w-3" />
          Translations
          {activeCount > 0 && (
            <span className="rounded-full bg-[var(--as-accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--as-accent)]">
              {activeCount}
            </span>
          )}
        </span>
        <span className="text-[10px]">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {AVAILABLE_LOCALES.map(({ code, label }) => (
            <div
              key={code}
              className="grid grid-cols-[70px_1fr] items-center gap-2"
            >
              <span
                className="text-[10px] font-medium text-[var(--as-text-muted)]"
                title={label}
              >
                {code}
              </span>
              <Input
                value={locales[code] ?? ""}
                placeholder={layer.staticValue || "(same as default)"}
                onChange={(e) =>
                  patch({
                    locales: { ...locales, [code]: e.target.value },
                  })
                }
              />
            </div>
          ))}
          <p className="text-[10px] text-[var(--as-text-subtle)]">
            Empty cells fall back to the default text above.
          </p>
        </div>
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
