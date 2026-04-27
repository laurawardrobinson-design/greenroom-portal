"use client";

import React, { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  CheckSquare,
  Square,
} from "lucide-react";
import {
  SIZE_PRESETS,
  CATEGORY_META,
  type SizePreset,
  type SizePresetCategory,
} from "@/lib/asset-studio/size-presets";

const ALLOWED_ROLES = ["Admin", "Producer", "Post Producer", "Designer"];

const LAYER_ICONS: Record<TemplateLayerType, React.ElementType> = {
  text: TypeIcon,
  image: ImageIcon,
  logo: ImagePlus,
  shape: ShapeIcon,
};

function clampPct(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const RESIZE_HANDLES: Array<{ handle: ResizeHandle; className: string }> = [
  { handle: "nw", className: "-left-1 -top-1 cursor-nwse-resize" },
  { handle: "n", className: "left-1/2 -top-1 -translate-x-1/2 cursor-ns-resize" },
  { handle: "ne", className: "-right-1 -top-1 cursor-nesw-resize" },
  { handle: "e", className: "-right-1 top-1/2 -translate-y-1/2 cursor-ew-resize" },
  { handle: "se", className: "-right-1 -bottom-1 cursor-nwse-resize" },
  { handle: "s", className: "left-1/2 -bottom-1 -translate-x-1/2 cursor-ns-resize" },
  { handle: "sw", className: "-left-1 -bottom-1 cursor-nesw-resize" },
  { handle: "w", className: "-left-1 top-1/2 -translate-y-1/2 cursor-ew-resize" },
];

function PanelCornerHandle({
  side,
  onPointerDown,
}: {
  side: "left" | "right";
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const sideClass = side === "left" ? "-right-1" : "-left-1";
  const barsAlignClass = side === "left" ? "items-end" : "items-start";

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      className={`absolute ${sideClass} -bottom-1 z-10 flex h-4 w-4 cursor-nwse-resize ${barsAlignClass} justify-end rounded-sm bg-[var(--as-surface)]/90 p-[2px] text-[var(--as-text-subtle)] shadow-sm ring-1 ring-[var(--as-border)] transition-colors hover:text-[var(--as-accent)]`}
      aria-label="Resize panel"
      title="Drag corner to resize panel"
    >
      <span className="pointer-events-none flex flex-col gap-[1px]">
        <span className="h-px w-1.5 rounded bg-current/90" />
        <span className="h-px w-2.5 rounded bg-current/80" />
        <span className="h-px w-3.5 rounded bg-current/70" />
      </span>
    </button>
  );
}

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
  const [showLayersPanel, setShowLayersPanel] = useState(true);
  const [showInspectorPanel, setShowInspectorPanel] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(300);
  const [rightPanelWidth, setRightPanelWidth] = useState(380);
  const [isWideLayout, setIsWideLayout] = useState(false);
  const [panelResize, setPanelResize] = useState<{
    side: "left" | "right";
    startX: number;
    startWidth: number;
  } | null>(null);
  const { toast } = useToast();

  const deleteLayer = useCallback(
    async (layerId: string, opts?: { confirm?: boolean }) => {
      if (opts?.confirm !== false && !window.confirm("Delete this layer?")) return;
      try {
        const res = await fetch(
          `/api/asset-studio/templates/${templateId}/layers/${layerId}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error();
        if (selectedLayerId === layerId) setSelectedLayerId(null);
        await mutate(url);
        toast("success", "Layer deleted");
      } catch {
        toast("error", "Couldn't delete layer");
      }
    },
    [selectedLayerId, setSelectedLayerId, templateId, toast, url]
  );

  // Escape exits fullscreen. Cmd/Ctrl+. toggles it — keeping it off common
  // browser shortcuts so we don't fight Cmd+F (find) or F11 (browser FS).
  useEffect(() => {
    function onResize() {
      setIsWideLayout(window.innerWidth >= 1024);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setShowLayersPanel((v) => !v);
        setShowInspectorPanel((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  useEffect(() => {
    if (!panelResize) return;
    const activeResize = panelResize;
    function onMove(e: PointerEvent) {
      const dx = e.clientX - activeResize.startX;
      if (activeResize.side === "left") {
        const next = clampPct(activeResize.startWidth + dx, 220, 560);
        setLeftPanelWidth(next);
      } else {
        const next = clampPct(activeResize.startWidth - dx, 280, 680);
        setRightPanelWidth(next);
      }
    }
    function onUp() {
      setPanelResize(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [panelResize]);

  const canvasMaxWidthPx =
    showLayersPanel && showInspectorPanel
      ? 1080
      : showLayersPanel || showInspectorPanel
        ? 1360
        : 1720;

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
          showLayersPanel={showLayersPanel}
          showInspectorPanel={showInspectorPanel}
          onToggleLayersPanel={() => setShowLayersPanel((v) => !v)}
          onToggleInspectorPanel={() => setShowInspectorPanel((v) => !v)}
        />

        <div
          className={`flex gap-4 ${
            isWideLayout ? "items-stretch" : "flex-col"
          }`}
        >
          {showLayersPanel && (
            <div
              className="relative w-full shrink-0"
              style={isWideLayout ? { width: `${leftPanelWidth}px` } : undefined}
            >
              <LayerTree
                templateId={templateId}
                layers={layers}
                selectedId={selectedLayerId}
                onSelect={setSelectedLayerId}
                onDeleteLayer={deleteLayer}
                mutateUrl={url}
              />
              {isWideLayout && (
                <PanelCornerHandle
                  side="left"
                  onPointerDown={(e) =>
                    setPanelResize({
                      side: "left",
                      startX: e.clientX,
                      startWidth: leftPanelWidth,
                    })
                  }
                />
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <CanvasPreview
              template={template}
              layers={layers}
              selectedId={selectedLayerId}
              onSelect={setSelectedLayerId}
              onDeleteLayer={deleteLayer}
              maxCanvasWidthPx={canvasMaxWidthPx}
              mutateUrl={url}
            />
          </div>

          {showInspectorPanel && (
            <div
              className="relative w-full shrink-0 space-y-4"
              style={isWideLayout ? { width: `${rightPanelWidth}px` } : undefined}
            >
              <PropertiesPanel
                layer={selectedLayer}
                canvasWidth={template.canvasWidth}
                canvasHeight={template.canvasHeight}
                onDeleteLayer={deleteLayer}
                mutateUrl={url}
              />
              <OutputSpecsPanel template={template} mutateUrl={url} />
              {isWideLayout && (
                <PanelCornerHandle
                  side="right"
                  onPointerDown={(e) =>
                    setPanelResize({
                      side: "right",
                      startX: e.clientX,
                      startWidth: rightPanelWidth,
                    })
                  }
                />
              )}
            </div>
          )}
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
  showLayersPanel,
  showInspectorPanel,
  onToggleLayersPanel,
  onToggleInspectorPanel,
}: {
  template: AssetTemplate;
  mutateUrl: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  showLayersPanel: boolean;
  showInspectorPanel: boolean;
  onToggleLayersPanel: () => void;
  onToggleInspectorPanel: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVersionsOpen = searchParams?.get("versions") === "open";
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

  const deliverableId = template.campaignDeliverableId;
  const { data: deliverableCtx } = useSWR<{
    id: string;
    campaignId: string;
    channel: string;
    format: string;
    width: number;
    height: number;
    campaign: { id: string; wf_number: string; name: string } | null;
  }>(deliverableId ? `/api/deliverables/${deliverableId}` : null, fetcher);

  const isForDeliverable = Boolean(deliverableId);
  const backHref = isForDeliverable ? "/asset-studio?tab=my_work" : "/asset-studio?tab=templates";
  const backLabel = isForDeliverable ? "Back to My Work" : "Back to templates";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--as-border)] bg-[var(--as-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(backHref)}
            className="rounded-md p-1.5 text-[var(--as-text-muted)] hover:bg-[var(--as-surface-2)]"
            aria-label={backLabel}
            title={backLabel}
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
        {deliverableCtx && (
          <div className="ml-9 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--as-text-muted)]">
            <span className="uppercase tracking-wider text-[var(--as-text-subtle)]">For:</span>
            {deliverableCtx.campaign && (
              <>
                <Link
                  href={`/campaigns/${deliverableCtx.campaign.id}`}
                  className="font-medium text-[var(--as-text)] hover:text-[var(--as-accent)]"
                >
                  {deliverableCtx.campaign.wf_number} {deliverableCtx.campaign.name}
                </Link>
                <span className="text-[var(--as-text-subtle)]">›</span>
              </>
            )}
            <span>
              {deliverableCtx.channel} {deliverableCtx.format} · {deliverableCtx.width}×{deliverableCtx.height}
            </span>
          </div>
        )}
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
        <VersionHistoryButton template={template} mutateUrl={mutateUrl} initialOpen={initialVersionsOpen} />
        <Link href={`/asset-studio/runs/new?templateId=${template.id}`}>
          <Button size="sm" variant="outline">
            New run
          </Button>
        </Link>
        <button
          type="button"
          onClick={onToggleLayersPanel}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--as-border)] bg-[var(--as-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--as-text-muted)] transition-colors hover:bg-[var(--as-surface-2)] hover:text-[var(--as-text)]"
          aria-label={showLayersPanel ? "Hide layers panel" : "Show layers panel"}
          title={showLayersPanel ? "Hide layers panel" : "Show layers panel"}
        >
          <Layers className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{showLayersPanel ? "Hide layers" : "Show layers"}</span>
        </button>
        <button
          type="button"
          onClick={onToggleInspectorPanel}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--as-border)] bg-[var(--as-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--as-text-muted)] transition-colors hover:bg-[var(--as-surface-2)] hover:text-[var(--as-text)]"
          aria-label={showInspectorPanel ? "Hide inspector panel" : "Show inspector panel"}
          title={showInspectorPanel ? "Hide inspector panel" : "Show inspector panel"}
        >
          <TypeIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{showInspectorPanel ? "Hide inspector" : "Show inspector"}</span>
        </button>
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
  initialOpen = false,
}: {
  template: AssetTemplate;
  mutateUrl: string;
  initialOpen?: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(initialOpen);
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
  onDeleteLayer,
  mutateUrl,
}: {
  templateId: string;
  layers: TemplateLayer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDeleteLayer: (id: string, opts?: { confirm?: boolean }) => Promise<void>;
  mutateUrl: string;
}) {
  const { toast } = useToast();
  const [addingCount, setAddingCount] = useState(0);
  const nextLayerIndexRef = useRef(0);

  useEffect(() => {
    const maxOrder = layers.reduce(
      (m, l) => Math.max(m, l.sortOrder, l.zIndex),
      -1
    );
    nextLayerIndexRef.current = maxOrder + 1;
  }, [layers]);

  async function addLayer(layerType: TemplateLayerType) {
    const layerIndex = nextLayerIndexRef.current++;
    setAddingCount((c) => c + 1);
    try {
      const defaultsByType: Record<
        TemplateLayerType,
        { widthPct: number; heightPct: number }
      > = {
        text: { widthPct: 60, heightPct: 14 },
        image: { widthPct: 40, heightPct: 42 },
        logo: { widthPct: 28, heightPct: 16 },
        shape: { widthPct: 32, heightPct: 24 },
      };
      const { widthPct, heightPct } = defaultsByType[layerType];
      const cascadeOffset = (layerIndex % 10) * 3;
      const xPct = clampPct(8 + cascadeOffset, 0, Math.max(0, 100 - widthPct));
      const yPct = clampPct(8 + cascadeOffset, 0, Math.max(0, 100 - heightPct));
      const res = await fetch(`/api/asset-studio/templates/${templateId}/layers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${layerType} ${layerIndex + 1}`,
          layerType,
          xPct,
          yPct,
          widthPct,
          heightPct,
          sortOrder: layerIndex,
          zIndex: layerIndex,
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
      setAddingCount((c) => Math.max(0, c - 1));
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
              <li
                key={l.id}
                className={`group relative ${
                  isSelected
                    ? "bg-[var(--as-layer-active)]"
                    : "hover:bg-[var(--as-layer-hover)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(l.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 pr-10 text-left text-xs text-[var(--as-text)] transition-colors"
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
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDeleteLayer(l.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--as-text-subtle)] opacity-0 transition-opacity hover:bg-[var(--as-surface-2)] hover:text-[var(--as-status-failed)] focus:opacity-100 group-hover:opacity-100"
                  aria-label="Delete layer"
                >
                  <Trash2 className="h-3 w-3" />
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
                className="flex items-center justify-center gap-1.5 rounded-md border border-[var(--as-border)] bg-[var(--as-surface)] px-2 py-1.5 text-xs font-medium text-[var(--as-text)] transition-colors hover:bg-[var(--as-layer-hover)] disabled:opacity-50"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="capitalize">{t}</span>
              </button>
            );
          })}
        </div>
        {addingCount > 0 && (
          <p className="mt-1 px-1 text-[10px] text-[var(--as-text-subtle)]">
            Adding {addingCount} layer{addingCount === 1 ? "" : "s"}…
          </p>
        )}
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
  onDeleteLayer,
  maxCanvasWidthPx,
  mutateUrl,
}: {
  template: AssetTemplate;
  layers: TemplateLayer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDeleteLayer: (id: string, opts?: { confirm?: boolean }) => Promise<void>;
  maxCanvasWidthPx: number;
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
    widthPct: number;
    heightPct: number;
  } | null>(null);
  const [resize, setResize] = useState<{
    layerId: string;
    handle: ResizeHandle;
    startX: number;
    startY: number;
    origXPct: number;
    origYPct: number;
    origWidthPct: number;
    origHeightPct: number;
  } | null>(null);
  const [resizeHud, setResizeHud] = useState<{
    clientX: number;
    clientY: number;
    widthPx: number;
    heightPx: number;
  } | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, { xPct: number; yPct: number; widthPct: number; heightPct: number }>
  >({});
  const nudgeSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNudgeRef = useRef<{
    layerId: string;
    geometry: { xPct: number; yPct: number; widthPct: number; heightPct: number };
  } | null>(null);
  const canvasWidthPx = Math.max(1, template.canvasWidth);
  const canvasHeightPx = Math.max(1, template.canvasHeight);

  const persistLayerGeometry = useCallback(
    async (
      layerId: string,
      geometry: { xPct: number; yPct: number; widthPct: number; heightPct: number }
    ) => {
      const snappedWidthPx = Math.max(
        1,
        Math.round((geometry.widthPct / 100) * canvasWidthPx)
      );
      const snappedHeightPx = Math.max(
        1,
        Math.round((geometry.heightPct / 100) * canvasHeightPx)
      );
      const maxX = Math.max(0, canvasWidthPx - snappedWidthPx);
      const maxY = Math.max(0, canvasHeightPx - snappedHeightPx);
      const xPx = clampPct(Math.round((geometry.xPct / 100) * canvasWidthPx), 0, maxX);
      const yPx = clampPct(Math.round((geometry.yPct / 100) * canvasHeightPx), 0, maxY);
      const widthPx = Math.max(1, Math.min(snappedWidthPx, canvasWidthPx - xPx));
      const heightPx = Math.max(1, Math.min(snappedHeightPx, canvasHeightPx - yPx));

      const xPct = (xPx / canvasWidthPx) * 100;
      const yPct = (yPx / canvasHeightPx) * 100;
      const widthPct = (widthPx / canvasWidthPx) * 100;
      const heightPct = (heightPx / canvasHeightPx) * 100;

      const res = await fetch(
        `/api/asset-studio/templates/${template.id}/layers/${layerId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ xPct, yPct, widthPct, heightPct }),
        }
      );
      if (!res.ok) throw new Error();
      await mutate(mutateUrl);
    },
    [canvasHeightPx, canvasWidthPx, mutateUrl, template.id]
  );

  const onPointerDownLayer = useCallback(
    async (e: React.PointerEvent, l: TemplateLayer) => {
      if (l.isLocked) return;
      e.stopPropagation();
      e.preventDefault();
      if (resize) return;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      if (e.altKey) {
        try {
          const nextOrder = layers.reduce(
            (m, layer) => Math.max(m, layer.sortOrder, layer.zIndex),
            -1
          ) + 1;
          const copyRes = await fetch(
            `/api/asset-studio/templates/${template.id}/layers`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: `${l.name} copy`,
                layerType: l.layerType,
                isDynamic: l.isDynamic,
                isLocked: l.isLocked,
                dataBinding: l.dataBinding,
                staticValue: l.staticValue,
                xPct: l.xPct,
                yPct: l.yPct,
                widthPct: l.widthPct,
                heightPct: l.heightPct,
                rotationDeg: l.rotationDeg,
                zIndex: nextOrder,
                sortOrder: nextOrder,
                props: l.props ?? {},
              }),
            }
          );
          if (!copyRes.ok) throw new Error();
          const duplicate = (await copyRes.json()) as TemplateLayer;
          mutate(mutateUrl);
          onSelect(duplicate.id);
          setDrag({
            layerId: duplicate.id,
            startX: e.clientX,
            startY: e.clientY,
            origXPct: duplicate.xPct,
            origYPct: duplicate.yPct,
            widthPct: duplicate.widthPct,
            heightPct: duplicate.heightPct,
          });
          return;
        } catch {
          toast("error", "Couldn't duplicate layer");
          target.releasePointerCapture?.(e.pointerId);
          return;
        }
      }

      onSelect(l.id);
      setDrag({
        layerId: l.id,
        startX: e.clientX,
        startY: e.clientY,
        origXPct: l.xPct,
        origYPct: l.yPct,
        widthPct: l.widthPct,
        heightPct: l.heightPct,
      });
    },
    [layers, mutateUrl, onSelect, resize, template.id, toast]
  );

  const onPointerMoveLayer = useCallback(
    (e: React.PointerEvent) => {
      if ((!drag && !resize) || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      if (resize) {
        const dxPct = ((e.clientX - resize.startX) / rect.width) * 100;
        const dyPct = ((e.clientY - resize.startY) / rect.height) * 100;
        const minWidthPct = (1 / Math.max(1, template.canvasWidth)) * 100;
        const minHeightPct = (1 / Math.max(1, template.canvasHeight)) * 100;

        let left = resize.origXPct;
        let top = resize.origYPct;
        let right = resize.origXPct + resize.origWidthPct;
        let bottom = resize.origYPct + resize.origHeightPct;

        if (resize.handle.includes("e")) {
          right = clampPct(right + dxPct, left + minWidthPct, 100);
        }
        if (resize.handle.includes("w")) {
          left = clampPct(left + dxPct, 0, right - minWidthPct);
        }
        if (resize.handle.includes("s")) {
          bottom = clampPct(bottom + dyPct, top + minHeightPct, 100);
        }
        if (resize.handle.includes("n")) {
          top = clampPct(top + dyPct, 0, bottom - minHeightPct);
        }

        const widthPct = Math.max(minWidthPct, right - left);
        const heightPct = Math.max(minHeightPct, bottom - top);
        const widthPx = Math.max(
          1,
          Math.round((widthPct / 100) * Math.max(1, template.canvasWidth))
        );
        const heightPx = Math.max(
          1,
          Math.round((heightPct / 100) * Math.max(1, template.canvasHeight))
        );

        setResizeHud({
          clientX: e.clientX,
          clientY: e.clientY,
          widthPx,
          heightPx,
        });
        setOverrides((o) => ({
          ...o,
          [resize.layerId]: {
            xPct: left,
            yPct: top,
            widthPct,
            heightPct,
          },
        }));
        return;
      }

      if (!drag) return;
      const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;
      const maxX = Math.max(0, 100 - drag.widthPct);
      const maxY = Math.max(0, 100 - drag.heightPct);
      const nextX = Math.max(0, Math.min(maxX, drag.origXPct + dxPct));
      const nextY = Math.max(0, Math.min(maxY, drag.origYPct + dyPct));
      setOverrides((o) => ({
        ...o,
        [drag.layerId]: {
          xPct: nextX,
          yPct: nextY,
          widthPct: drag.widthPct,
          heightPct: drag.heightPct,
        },
      }));
    },
    [drag, resize, template.canvasHeight, template.canvasWidth]
  );

  const onPointerDownHandle = useCallback(
    (e: React.PointerEvent, l: TemplateLayer, handle: ResizeHandle) => {
      if (l.isLocked) return;
      e.stopPropagation();
      e.preventDefault();
      onSelect(l.id);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDrag(null);
      setResize({
        layerId: l.id,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        origXPct: l.xPct,
        origYPct: l.yPct,
        origWidthPct: l.widthPct,
        origHeightPct: l.heightPct,
      });
      setResizeHud({
        clientX: e.clientX,
        clientY: e.clientY,
        widthPx: Math.max(
          1,
          Math.round((l.widthPct / 100) * Math.max(1, template.canvasWidth))
        ),
        heightPx: Math.max(
          1,
          Math.round((l.heightPct / 100) * Math.max(1, template.canvasHeight))
        ),
      });
    },
    [onSelect, template.canvasHeight, template.canvasWidth]
  );

  const onPointerUpLayer = useCallback(
    async (e: React.PointerEvent) => {
      const layerId = drag?.layerId ?? resize?.layerId;
      if (!layerId) return;
      const override = overrides[layerId];
      setDrag(null);
      setResize(null);
      setResizeHud(null);
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      if (!override) return;
      try {
        await persistLayerGeometry(layerId, override);
        setOverrides((o) => {
          const next = { ...o };
          delete next[layerId];
          return next;
        });
      } catch {
        toast("error", "Couldn't save position");
        setOverrides((o) => {
          const next = { ...o };
          delete next[layerId];
          return next;
        });
      }
    },
    [
      drag,
      overrides,
      persistLayerGeometry,
      resize,
      toast,
    ]
  );

  useEffect(() => {
    return () => {
      if (nudgeSaveTimeoutRef.current) {
        clearTimeout(nudgeSaveTimeoutRef.current);
        nudgeSaveTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!selectedId) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        void onDeleteLayer(selectedId);
        return;
      }

      if (drag || resize) return;

      const isArrow =
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown";
      if (!isArrow) return;

      const selectedLayer = layers.find((l) => l.id === selectedId);
      if (!selectedLayer || selectedLayer.isLocked) return;

      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const current = overrides[selectedId] ?? {
        xPct: selectedLayer.xPct,
        yPct: selectedLayer.yPct,
        widthPct: selectedLayer.widthPct,
        heightPct: selectedLayer.heightPct,
      };
      const widthPx = Math.max(
        1,
        Math.round((current.widthPct / 100) * canvasWidthPx)
      );
      const heightPx = Math.max(
        1,
        Math.round((current.heightPct / 100) * canvasHeightPx)
      );
      const maxX = Math.max(0, canvasWidthPx - widthPx);
      const maxY = Math.max(0, canvasHeightPx - heightPx);
      let nextXPx = clampPct(
        Math.round((current.xPct / 100) * canvasWidthPx),
        0,
        maxX
      );
      let nextYPx = clampPct(
        Math.round((current.yPct / 100) * canvasHeightPx),
        0,
        maxY
      );

      if (e.key === "ArrowLeft") nextXPx = Math.max(0, nextXPx - step);
      if (e.key === "ArrowRight") nextXPx = Math.min(maxX, nextXPx + step);
      if (e.key === "ArrowUp") nextYPx = Math.max(0, nextYPx - step);
      if (e.key === "ArrowDown") nextYPx = Math.min(maxY, nextYPx + step);

      const nextGeometry = {
        xPct: (nextXPx / canvasWidthPx) * 100,
        yPct: (nextYPx / canvasHeightPx) * 100,
        widthPct: current.widthPct,
        heightPct: current.heightPct,
      };

      setOverrides((o) => ({
        ...o,
        [selectedId]: nextGeometry,
      }));

      pendingNudgeRef.current = {
        layerId: selectedId,
        geometry: nextGeometry,
      };
      if (nudgeSaveTimeoutRef.current) {
        clearTimeout(nudgeSaveTimeoutRef.current);
      }
      nudgeSaveTimeoutRef.current = setTimeout(() => {
        const pending = pendingNudgeRef.current;
        if (!pending) return;
        pendingNudgeRef.current = null;
        void persistLayerGeometry(pending.layerId, pending.geometry)
          .then(() => {
            setOverrides((o) => {
              const next = { ...o };
              delete next[pending.layerId];
              return next;
            });
          })
          .catch(() => {
            toast("error", "Couldn't save position");
            setOverrides((o) => {
              const next = { ...o };
              delete next[pending.layerId];
              return next;
            });
          });
      }, 140);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canvasHeightPx,
    canvasWidthPx,
    drag,
    layers,
    onDeleteLayer,
    overrides,
    persistLayerGeometry,
    resize,
    selectedId,
    toast,
  ]);

  useEffect(() => {
    const pending = pendingNudgeRef.current;
    if (!pending) return;
    if (layers.some((l) => l.id === pending.layerId)) return;
    pendingNudgeRef.current = null;
    if (nudgeSaveTimeoutRef.current) {
      clearTimeout(nudgeSaveTimeoutRef.current);
      nudgeSaveTimeoutRef.current = null;
    }
  }, [layers]);

  return (
    <div className="rounded-xl border border-[var(--as-border)] bg-[var(--as-canvas-bg)] p-6">
      <div className="mx-auto w-full" style={{ maxWidth: `${maxCanvasWidthPx}px` }}>
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
            const width = o ? o.widthPct : l.widthPct;
            const height = o ? o.heightPct : l.heightPct;
            const layerTone =
              l.layerType === "text"
                ? "border-sky-500/70 bg-sky-100/35 hover:border-sky-600"
                : l.layerType === "image"
                  ? "border-violet-500/70 bg-violet-100/35 hover:border-violet-600"
                  : l.layerType === "logo"
                    ? "border-emerald-500/70 bg-emerald-100/35 hover:border-emerald-600"
                    : "border-amber-500/70 bg-amber-100/35 hover:border-amber-600";
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
                className={`absolute flex items-center justify-center overflow-visible border-2 text-[10px] font-medium transition-all ${
                  l.isLocked ? "cursor-not-allowed" : "cursor-move"
                } ${
                  isSelected
                    ? "border-[var(--as-handle-color)] bg-[var(--as-accent-soft)]/65 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
                    : l.isLocked
                      ? "border-[var(--as-handle-locked)]/55 bg-zinc-200/35 hover:border-[var(--as-handle-locked)]"
                      : layerTone
                }`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                  zIndex: l.zIndex,
                  touchAction: "none",
                }}
                aria-label={`Select layer ${l.name}`}
              >
                <span
                  className={`max-w-full truncate px-1 text-center ${
                    isSelected
                      ? "text-[var(--as-text)]"
                      : "text-zinc-800"
                  }`}
                >
                  {l.layerType === "text" || l.layerType === "logo"
                    ? l.isDynamic
                      ? `{{${l.dataBinding}}}`
                      : l.staticValue || l.name
                    : l.name}
                </span>
                {isSelected &&
                  !l.isLocked &&
                  RESIZE_HANDLES.map(({ handle, className }) => (
                    <span
                      key={handle}
                      className={`absolute z-10 h-2.5 w-2.5 rounded-[2px] border border-white/70 bg-[var(--as-accent)] shadow ${className}`}
                      onPointerDown={(e) => onPointerDownHandle(e, l, handle)}
                      onPointerMove={onPointerMoveLayer}
                      onPointerUp={onPointerUpLayer}
                      onPointerCancel={onPointerUpLayer}
                    />
                  ))}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs text-white/50">
          {template.canvasWidth} × {template.canvasHeight}px · drag to reposition · Alt+drag duplicates · Arrow keys nudge by 1px (Shift+Arrow = 10px)
        </p>
      </div>
      {resizeHud && (
        <div
          className="pointer-events-none fixed z-[70] rounded-md border border-white/20 bg-black/85 px-2 py-1 text-[11px] font-semibold text-white shadow-lg"
          style={{
            left: `${resizeHud.clientX + 12}px`,
            top: `${resizeHud.clientY + 12}px`,
          }}
        >
          {resizeHud.widthPx} × {resizeHud.heightPx}px
        </div>
      )}
    </div>
  );
}

// ─── Properties panel ────────────────────────────────────────────────────────

function PropertiesPanel({
  layer,
  canvasWidth,
  canvasHeight,
  onDeleteLayer,
  mutateUrl,
}: {
  layer: TemplateLayer | null;
  canvasWidth: number;
  canvasHeight: number;
  onDeleteLayer: (id: string, opts?: { confirm?: boolean }) => Promise<void>;
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
  const activeLayer = layer;

  async function patch(patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/asset-studio/templates/${activeLayer.templateId}/layers/${activeLayer.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      if (!res.ok) throw new Error();
      await mutate(mutateUrl);
    } catch {
      toast("error", "Couldn't update layer");
    } finally {
      setBusy(false);
    }
  }

  const isText = activeLayer.layerType === "text";
  const isImage =
    activeLayer.layerType === "image" || activeLayer.layerType === "logo";
  const safeCanvasWidth = Math.max(1, canvasWidth);
  const safeCanvasHeight = Math.max(1, canvasHeight);
  const xPx = Math.round((activeLayer.xPct / 100) * safeCanvasWidth);
  const yPx = Math.round((activeLayer.yPct / 100) * safeCanvasHeight);
  const widthPx = Math.max(
    1,
    Math.round((activeLayer.widthPct / 100) * safeCanvasWidth)
  );
  const heightPx = Math.max(
    1,
    Math.round((activeLayer.heightPct / 100) * safeCanvasHeight)
  );
  const maxXPx = Math.max(0, safeCanvasWidth - widthPx);
  const maxYPx = Math.max(0, safeCanvasHeight - heightPx);

  function parseNumberInput(raw: string, fallback: number): number {
    const trimmed = raw.trim();
    if (!trimmed) return fallback;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function onCommitEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.currentTarget.blur();
  }

  async function commitXPx(raw: string, target: HTMLInputElement) {
    const nextPx = clampPct(Math.round(parseNumberInput(raw, xPx)), 0, maxXPx);
    target.value = String(nextPx);
    await patch({ xPct: (nextPx / safeCanvasWidth) * 100 });
  }

  async function commitYPx(raw: string, target: HTMLInputElement) {
    const nextPx = clampPct(Math.round(parseNumberInput(raw, yPx)), 0, maxYPx);
    target.value = String(nextPx);
    await patch({ yPct: (nextPx / safeCanvasHeight) * 100 });
  }

  async function commitWidthPx(raw: string, target: HTMLInputElement) {
    const nextWidthPx = clampPct(
      Math.round(parseNumberInput(raw, widthPx)),
      1,
      safeCanvasWidth
    );
    const nextXPx = clampPct(xPx, 0, Math.max(0, safeCanvasWidth - nextWidthPx));
    target.value = String(nextWidthPx);
    await patch({
      widthPct: (nextWidthPx / safeCanvasWidth) * 100,
      xPct: (nextXPx / safeCanvasWidth) * 100,
    });
  }

  async function commitHeightPx(raw: string, target: HTMLInputElement) {
    const nextHeightPx = clampPct(
      Math.round(parseNumberInput(raw, heightPx)),
      1,
      safeCanvasHeight
    );
    const nextYPx = clampPct(yPx, 0, Math.max(0, safeCanvasHeight - nextHeightPx));
    target.value = String(nextHeightPx);
    await patch({
      heightPct: (nextHeightPx / safeCanvasHeight) * 100,
      yPct: (nextYPx / safeCanvasHeight) * 100,
    });
  }

  async function commitXPct(raw: string, target: HTMLInputElement) {
    const next = clampPct(
      parseNumberInput(raw, activeLayer.xPct),
      0,
      Math.max(0, 100 - activeLayer.widthPct)
    );
    const rounded = Math.round(next * 1000) / 1000;
    target.value = String(rounded);
    await patch({ xPct: rounded });
  }

  async function commitYPct(raw: string, target: HTMLInputElement) {
    const next = clampPct(
      parseNumberInput(raw, activeLayer.yPct),
      0,
      Math.max(0, 100 - activeLayer.heightPct)
    );
    const rounded = Math.round(next * 1000) / 1000;
    target.value = String(rounded);
    await patch({ yPct: rounded });
  }

  async function commitWidthPct(raw: string, target: HTMLInputElement) {
    const widthPct = clampPct(parseNumberInput(raw, activeLayer.widthPct), 1, 100);
    const nextXPct = clampPct(activeLayer.xPct, 0, Math.max(0, 100 - widthPct));
    const roundedWidth = Math.round(widthPct * 1000) / 1000;
    const roundedX = Math.round(nextXPct * 1000) / 1000;
    target.value = String(roundedWidth);
    await patch({
      widthPct: roundedWidth,
      xPct: roundedX,
    });
  }

  async function commitHeightPct(raw: string, target: HTMLInputElement) {
    const heightPct = clampPct(parseNumberInput(raw, activeLayer.heightPct), 1, 100);
    const nextYPct = clampPct(activeLayer.yPct, 0, Math.max(0, 100 - heightPct));
    const roundedHeight = Math.round(heightPct * 1000) / 1000;
    const roundedY = Math.round(nextYPct * 1000) / 1000;
    target.value = String(roundedHeight);
    await patch({
      heightPct: roundedHeight,
      yPct: roundedY,
    });
  }

  async function commitFontSize(raw: string, target: HTMLInputElement) {
    const next = clampPct(
      Math.round(parseNumberInput(raw, Number(activeLayer.props?.font_size) || 48)),
      8,
      400
    );
    target.value = String(next);
    await patch({
      props: { ...activeLayer.props, font_size: next },
    });
  }

  async function commitFontWeight(raw: string, target: HTMLInputElement) {
    const parsed = parseNumberInput(
      raw,
      Number(activeLayer.props?.font_weight) || 600
    );
    const clamped = clampPct(Math.round(parsed), 100, 900);
    const snapped = clampPct(Math.round(clamped / 100) * 100, 100, 900);
    target.value = String(snapped);
    await patch({
      props: { ...activeLayer.props, font_weight: snapped },
    });
  }

  async function commitName(raw: string, target: HTMLInputElement) {
    const next = raw.trim() || activeLayer.name;
    target.value = next;
    if (next === activeLayer.name) return;
    await patch({ name: next });
  }

  async function commitDataBinding(raw: string, target: HTMLInputElement) {
    const next = raw.trim();
    target.value = next;
    if (next === activeLayer.dataBinding) return;
    await patch({ dataBinding: next });
  }

  async function commitStaticValue(raw: string, target: HTMLInputElement) {
    const next = raw;
    target.value = next;
    if (next === activeLayer.staticValue) return;
    await patch({ staticValue: next });
  }

  async function commitColorHex(raw: string, target: HTMLInputElement) {
    const fallback = String(activeLayer.props?.color ?? "#1F1F1F");
    const trimmed = raw.trim();
    const next = /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
    target.value = next;
    if (next === fallback) return;
    await patch({
      props: { ...activeLayer.props, color: next },
    });
  }

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
          key={`${layer.id}-name-${layer.name}`}
          defaultValue={layer.name}
          onKeyDown={onCommitEnter}
          onBlur={(e) => void commitName(e.currentTarget.value, e.currentTarget)}
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
            key={`${layer.id}-binding-${layer.dataBinding}`}
            defaultValue={layer.dataBinding}
            placeholder="product.name"
            onKeyDown={onCommitEnter}
            onBlur={(e) =>
              void commitDataBinding(e.currentTarget.value, e.currentTarget)
            }
          />
        </Field>
      ) : isText ? (
        <>
          <Field label="Text content">
            <Input
              key={`${layer.id}-static-${layer.staticValue}`}
              defaultValue={layer.staticValue}
              placeholder="Type text…"
              onKeyDown={onCommitEnter}
              onBlur={(e) =>
                void commitStaticValue(e.currentTarget.value, e.currentTarget)
              }
            />
          </Field>
          <TextLayerTranslations layer={layer} patch={patch} />
        </>
      ) : (
        <Field label="Source">
          <AssetUrlInput
            value={layer.staticValue}
            onCommit={(next) => patch({ staticValue: next })}
            layerType={layer.layerType}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="X (px)">
          <Input
            key={`${layer.id}-x-px-${xPx}-${widthPx}`}
            type="number"
            min={0}
            max={maxXPx}
            step={1}
            defaultValue={xPx}
            onKeyDown={onCommitEnter}
            onBlur={(e) => void commitXPx(e.currentTarget.value, e.currentTarget)}
          />
        </Field>
        <Field label="Y (px)">
          <Input
            key={`${layer.id}-y-px-${yPx}-${heightPx}`}
            type="number"
            min={0}
            max={maxYPx}
            step={1}
            defaultValue={yPx}
            onKeyDown={onCommitEnter}
            onBlur={(e) => void commitYPx(e.currentTarget.value, e.currentTarget)}
          />
        </Field>
        <Field label="W (px)">
          <Input
            key={`${layer.id}-w-px-${widthPx}-${xPx}`}
            type="number"
            min={1}
            max={safeCanvasWidth}
            step={1}
            defaultValue={widthPx}
            onKeyDown={onCommitEnter}
            onBlur={(e) =>
              void commitWidthPx(e.currentTarget.value, e.currentTarget)
            }
          />
        </Field>
        <Field label="H (px)">
          <Input
            key={`${layer.id}-h-px-${heightPx}-${yPx}`}
            type="number"
            min={1}
            max={safeCanvasHeight}
            step={1}
            defaultValue={heightPx}
            onKeyDown={onCommitEnter}
            onBlur={(e) =>
              void commitHeightPx(e.currentTarget.value, e.currentTarget)
            }
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="X (%)">
          <Input
            key={`${layer.id}-x-pct-${layer.xPct}-${layer.widthPct}`}
            type="number"
            min={0}
            max={Math.max(0, 100 - layer.widthPct)}
            step={0.01}
            defaultValue={layer.xPct}
            onKeyDown={onCommitEnter}
            onBlur={(e) => void commitXPct(e.currentTarget.value, e.currentTarget)}
          />
        </Field>
        <Field label="Y (%)">
          <Input
            key={`${layer.id}-y-pct-${layer.yPct}-${layer.heightPct}`}
            type="number"
            min={0}
            max={Math.max(0, 100 - layer.heightPct)}
            step={0.01}
            defaultValue={layer.yPct}
            onKeyDown={onCommitEnter}
            onBlur={(e) => void commitYPct(e.currentTarget.value, e.currentTarget)}
          />
        </Field>
        <Field label="W (%)">
          <Input
            key={`${layer.id}-w-pct-${layer.widthPct}-${layer.xPct}`}
            type="number"
            min={1}
            max={100}
            step={0.01}
            defaultValue={layer.widthPct}
            onKeyDown={onCommitEnter}
            onBlur={(e) =>
              void commitWidthPct(e.currentTarget.value, e.currentTarget)
            }
          />
        </Field>
        <Field label="H (%)">
          <Input
            key={`${layer.id}-h-pct-${layer.heightPct}-${layer.yPct}`}
            type="number"
            min={1}
            max={100}
            step={0.01}
            defaultValue={layer.heightPct}
            onKeyDown={onCommitEnter}
            onBlur={(e) =>
              void commitHeightPct(e.currentTarget.value, e.currentTarget)
            }
          />
        </Field>
      </div>

      {isText && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Font size">
              <Input
                key={`${layer.id}-font-size-${Number(layer.props?.font_size) || 48}`}
                type="number"
                min={8}
                max={400}
                step={1}
                defaultValue={Number(layer.props?.font_size) || 48}
                onKeyDown={onCommitEnter}
                onBlur={(e) =>
                  void commitFontSize(e.currentTarget.value, e.currentTarget)
                }
              />
            </Field>
            <Field label="Font weight">
              <Input
                key={`${layer.id}-font-weight-${Number(layer.props?.font_weight) || 600}`}
                type="number"
                min={100}
                max={900}
                step={100}
                defaultValue={Number(layer.props?.font_weight) || 600}
                onKeyDown={onCommitEnter}
                onBlur={(e) =>
                  void commitFontWeight(e.currentTarget.value, e.currentTarget)
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
                key={`${layer.id}-font-color-${String(layer.props?.color ?? "#1F1F1F")}`}
                defaultValue={String(layer.props?.color ?? "#1F1F1F")}
                className="flex-1 text-xs"
                onKeyDown={onCommitEnter}
                onBlur={(e) =>
                  void commitColorHex(e.currentTarget.value, e.currentTarget)
                }
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
      <button
        type="button"
        onClick={() => void onDeleteLayer(layer.id)}
        className="w-full rounded-md border border-[var(--as-border)] px-3 py-2 text-xs font-medium text-[var(--as-status-failed)] transition-colors hover:bg-[var(--as-surface-2)]"
      >
        Delete layer
      </button>
    </div>
  );
}

// Combined URL + upload input for image / logo layer sources. Lets the
// designer paste a URL or upload a file; on successful upload we flip
// the field to the returned public URL.
function AssetUrlInput({
  value,
  onCommit,
  layerType,
}: {
  value: string;
  onCommit: (next: string) => Promise<void> | void;
  layerType: TemplateLayerType;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit(raw: string) {
    const next = raw.trim();
    setDraft(next);
    if (next === value) return;
    void onCommit(next);
  }

  function onDraftKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.currentTarget.blur();
  }

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
      setDraft(body.publicUrl);
      void onCommit(body.publicUrl);
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
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="/path/to/image.png or paste URL"
        onKeyDown={onDraftKeyDown}
        onBlur={(e) => commit(e.currentTarget.value)}
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
  patch: (p: Partial<TemplateLayer>) => Promise<void> | void;
}) {
  const [open, setOpen] = React.useState(
    Object.keys(layer.locales ?? {}).length > 0
  );
  const locales = layer.locales ?? {};
  const activeCount = Object.values(locales).filter((v) => v?.trim()).length;
  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.currentTarget.blur();
  }

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
                key={`${layer.id}-${code}-${locales[code] ?? ""}`}
                defaultValue={locales[code] ?? ""}
                placeholder={layer.staticValue || "(same as default)"}
                onKeyDown={onInputKeyDown}
                onBlur={(e) =>
                  void patch({
                    locales: { ...locales, [code]: e.currentTarget.value },
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

  const [presetOpen, setPresetOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--as-border)] bg-[var(--as-surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--as-text)]">Output sizes</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPresetOpen(true)}
            disabled={busy}
            className="text-xs font-medium text-[var(--as-accent)] hover:text-[var(--as-accent-hover)]"
          >
            + POP &amp; digital pack
          </button>
          <button
            type="button"
            onClick={ensureDefaults}
            disabled={busy}
            className="text-xs font-medium text-[var(--as-text-muted)] hover:text-[var(--as-text)]"
          >
            + Defaults
          </button>
        </div>
      </div>
      {specs.length === 0 ? (
        <p className="text-xs text-[var(--as-text-muted)]">
          No output sizes. Add retail POP + digital sizes, or the Storyteq
          defaults (1:1, 4:5, 9:16).
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
      {presetOpen && (
        <PresetPickerModal
          templateId={template.id}
          existing={specs}
          onClose={() => setPresetOpen(false)}
          onApplied={() => {
            mutate(mutateUrl);
            setPresetOpen(false);
          }}
        />
      )}
    </div>
  );
}

function PresetPickerModal({
  templateId,
  existing,
  onClose,
  onApplied,
}: {
  templateId: string;
  existing: TemplateOutputSpec[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Build a lookup of existing sizes so we can gray out already-added presets.
  const existingKeys = new Set(
    existing.map((s) => `${s.label}|${s.width}x${s.height}`)
  );

  const grouped: Record<SizePresetCategory, SizePreset[]> = {
    shelf: [],
    aisle: [],
    endcap: [],
    counter: [],
    window: [],
    print: [],
    social: [],
    email: [],
    display: [],
  };
  for (const p of SIZE_PRESETS) grouped[p.category].push(p);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function selectGroup(group: "physical" | "digital") {
    const picks = SIZE_PRESETS.filter(
      (p) =>
        CATEGORY_META[p.category].group === group &&
        !existingKeys.has(`${p.label}|${p.width}x${p.height}`)
    ).map((p) => p.code);
    setSelected(new Set(picks));
  }

  async function apply() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/asset-studio/templates/${templateId}/output-specs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ presetCodes: Array.from(selected) }),
        }
      );
      const body = (await res.json()) as {
        created?: number;
        duplicates?: string[];
        skipped?: string[];
      };
      if (!res.ok) throw new Error("Request failed");
      const msg = `Added ${body.created ?? 0} size${body.created === 1 ? "" : "s"}${
        body.duplicates && body.duplicates.length > 0
          ? ` (${body.duplicates.length} already present)`
          : ""
      }`;
      toast("success", msg);
      onApplied();
    } catch {
      toast("error", "Couldn't apply preset pack");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-[var(--as-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--as-border)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--as-text)]">
              Retail POP + digital sizes
            </h2>
            <p className="text-[11px] text-[var(--as-text-muted)]">
              Applied in one batch. Already-present sizes are skipped automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--as-text-subtle)] hover:bg-[var(--as-surface-2)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-[var(--as-border)] bg-[var(--as-surface-2)] px-4 py-2 text-[11px]">
          <button
            type="button"
            onClick={() => selectGroup("physical")}
            className="rounded-md border border-[var(--as-border)] px-2 py-1 font-medium hover:bg-[var(--as-layer-hover)]"
          >
            Select all in-store + print
          </button>
          <button
            type="button"
            onClick={() => selectGroup("digital")}
            className="rounded-md border border-[var(--as-border)] px-2 py-1 font-medium hover:bg-[var(--as-layer-hover)]"
          >
            Select all digital
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-md border border-[var(--as-border)] px-2 py-1 font-medium text-[var(--as-text-muted)] hover:bg-[var(--as-layer-hover)]"
          >
            Clear
          </button>
          <span className="ml-auto self-center text-[var(--as-text-muted)]">
            {selected.size} selected
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {(
            Object.keys(CATEGORY_META) as SizePresetCategory[]
          ).map((cat) => (
            <div key={cat} className="mb-4 last:mb-0">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--as-text-muted)]">
                  {CATEGORY_META[cat].label}
                </h3>
                <span className="text-[10px] text-[var(--as-text-subtle)]">
                  {CATEGORY_META[cat].group === "physical" ? "In-store / print" : "Digital"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
                {grouped[cat].map((p) => {
                  const isExisting = existingKeys.has(
                    `${p.label}|${p.width}x${p.height}`
                  );
                  const isSelected = selected.has(p.code);
                  return (
                    <button
                      key={p.code}
                      type="button"
                      disabled={isExisting}
                      onClick={() => toggle(p.code)}
                      className={`flex flex-col items-start rounded-md border p-2 text-left transition-colors ${
                        isExisting
                          ? "cursor-default border-[var(--as-border)] bg-[var(--as-surface-2)] opacity-50"
                          : isSelected
                            ? "border-[var(--as-accent)] bg-[var(--as-accent-soft)]"
                            : "border-[var(--as-border)] hover:bg-[var(--as-layer-hover)]"
                      }`}
                      title={p.description}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-medium text-[var(--as-text)]">
                          {p.label}
                        </span>
                        {isExisting ? (
                          <span className="text-[10px] text-[var(--as-text-subtle)]">
                            added
                          </span>
                        ) : isSelected ? (
                          <CheckSquare className="h-3.5 w-3.5 text-[var(--as-accent)]" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-[var(--as-text-subtle)]" />
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--as-text-subtle)]">
                        {p.width}×{p.height}
                        {p.physical
                          ? ` · ${p.physical.widthIn}×${p.physical.heightIn} in`
                          : ""}
                        {" · "}
                        {p.format.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--as-border)] px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={selected.size === 0 || busy} loading={busy} onClick={apply}>
            Add {selected.size || ""} size{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </div>
  );
}
