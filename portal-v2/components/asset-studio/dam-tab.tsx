"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import type {
  AppUser,
  Campaign,
  DamAsset,
  DamAssetLibraryResponse,
  DamAssetSource,
  DamAssetStatus,
} from "@/types/domain";
import { fetcher, fmtRelative, statusPillClass } from "./lib";
import { Camera, FolderSync, Layers, WandSparkles, Plus, Tag, X } from "lucide-react";

interface Props {
  user: AppUser;
  // When set, lock DAM to this campaign and hide the picker (used by /campaigns/[id]/asset-studio).
  lockedCampaignId?: string;
}

const STATUS_OPTIONS: Array<{ value: "" | DamAssetStatus; label: string }> = [
  { value: "", label: "All" },
  { value: "ingested", label: "Ingested" },
  { value: "retouching", label: "Retouching" },
  { value: "retouched", label: "Retouched" },
  { value: "versioning", label: "Versioning" },
  { value: "ready_for_activation", label: "Ready" },
  { value: "archived", label: "Archived" },
];

const LIFECYCLE_STATUSES: DamAssetStatus[] = [
  "ingested",
  "retouching",
  "retouched",
  "versioning",
  "ready_for_activation",
  "archived",
];

export function DamTab({ user, lockedCampaignId }: Props) {
  const searchParams = useSearchParams();
  const initialCampaignId = lockedCampaignId ?? searchParams.get("campaignId") ?? "all";
  const [campaignId, setCampaignId] = useState<string>(initialCampaignId);
  const [status, setStatus] = useState<"" | DamAssetStatus>("");
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: campaigns } = useSWR<Campaign[]>("/api/campaigns", fetcher);

  const params = new URLSearchParams();
  params.set("includeSources", "true");
  if (campaignId !== "all") params.set("campaignId", campaignId);
  if (status) params.set("status", status);

  const url = `/api/asset-studio/dam-assets?${params.toString()}`;
  const { data, isLoading, mutate, error } = useSWR<DamAssetLibraryResponse>(url, fetcher);

  const canManage = ["Admin", "Producer", "Post Producer", "Designer", "Art Director"].includes(
    user.role
  );

  const assets = data?.assets ?? [];
  const sourceAssets = data?.sourceAssets ?? [];
  const selectedCampaign =
    campaignId !== "all" ? (campaigns ?? []).find((c) => c.id === campaignId) ?? null : null;

  const ingestableCount = sourceAssets.filter((s) => !s.ingested).length;

  async function withAction(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
      await mutate();
    } catch (err) {
      console.error(err);
      toast("error", (err as Error).message || "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function ingest(source: DamAssetSource) {
    await withAction(`ingest:${source.id}`, async () => {
      const res = await fetch("/api/asset-studio/dam-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignAssetId: source.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not ingest asset");
      }
      toast("success", `${source.fileName} added to DAM placeholder`);
    });
  }

  async function requestPhotoshop(asset: DamAsset) {
    const note = window.prompt(
      "Photoshop handoff note (optional)",
      asset.photoshopNote || ""
    );
    if (note === null) return;

    await withAction(`ps:${asset.id}`, async () => {
      const res = await fetch(`/api/asset-studio/dam-assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_photoshop",
          photoshopNote: note,
          status: "retouching",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not queue Photoshop handoff");
      }
      toast("info", "Photoshop handoff placeholder recorded");
    });
  }

  async function updateStatus(asset: DamAsset, nextStatus: DamAssetStatus) {
    await withAction(`status:${asset.id}`, async () => {
      const res = await fetch(`/api/asset-studio/dam-assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not update status");
      }
      toast("success", `Lifecycle set to ${nextStatus.replaceAll("_", " ")}`);
    });
  }

  async function createVersion(asset: DamAsset) {
    const nextNumber = (asset.versions?.[0]?.versionNumber ?? 0) + 1;
    const label = window.prompt("Version label", `v${nextNumber}`);
    if (label === null) return;
    const notes = window.prompt("Version notes (optional)", "") ?? "";

    await withAction(`ver:${asset.id}`, async () => {
      const res = await fetch(`/api/asset-studio/dam-assets/${asset.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          notes,
          stage: "versioning",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not create version");
      }
      toast("success", `Created ${label || `v${nextNumber}`} in version history`);
    });
  }

  async function linkToSelectedCampaign(asset: DamAsset) {
    if (campaignId === "all") {
      toast("info", "Select a campaign first, then link this DAM asset.");
      return;
    }

    await withAction(`link:${asset.id}:${campaignId}`, async () => {
      const res = await fetch(`/api/asset-studio/dam-assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link_campaign",
          campaignId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not link campaign");
      }
      toast(
        "success",
        `Linked to ${selectedCampaign?.wfNumber ? `${selectedCampaign.wfNumber} · ` : ""}${selectedCampaign?.name ?? "campaign"}`
      );
    });
  }

  async function unlinkFromSelectedCampaign(asset: DamAsset) {
    if (campaignId === "all") {
      toast("info", "Select a campaign first, then unlink this DAM asset.");
      return;
    }

    const confirmed = window.confirm(
      `Unlink "${asset.name}" from ${selectedCampaign?.name ?? "this campaign"}?`
    );
    if (!confirmed) return;

    await withAction(`unlink:${asset.id}:${campaignId}`, async () => {
      const res = await fetch(`/api/asset-studio/dam-assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlink_campaign",
          campaignId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not unlink campaign");
      }
      toast(
        "success",
        `Unlinked from ${selectedCampaign?.wfNumber ? `${selectedCampaign.wfNumber} · ` : ""}${selectedCampaign?.name ?? "campaign"}`
      );
    });
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-xl border border-[var(--as-border)] bg-[var(--as-surface)]"
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Couldn’t load DAM placeholder"
        description="Try reloading the page. If the problem persists, contact the admin."
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card
        padding="lg"
        className="flex flex-col gap-3 border-[var(--as-border)] bg-[var(--as-surface)] lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[var(--as-accent-soft)] p-2">
            <FolderSync className="h-5 w-5 text-[var(--as-accent)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--as-text)]">DAM placeholder</h2>
            <p className="text-sm text-[var(--as-text-muted)]">
              Campaign-shot assets ingest here first. External DAM remains authoritative; this is the prototype bridge.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
          <Stat label="Campaign assets" value={sourceAssets.length} />
          <Stat label="Ready to ingest" value={ingestableCount} />
          <Stat label="In DAM" value={assets.length} />
        </div>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!lockedCampaignId && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[var(--as-text-muted)]">Campaign</label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="rounded-md border border-[var(--as-border)] bg-[var(--as-surface)] px-2.5 py-1.5 text-xs text-[var(--as-text)]"
            >
              <option value="all">All campaigns</option>
              {(campaigns ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.wfNumber ? `${c.wfNumber} ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-1 flex-wrap gap-1 sm:justify-end">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                status === opt.value
                  ? "bg-[var(--as-accent-soft)] text-[var(--as-accent)]"
                  : "text-[var(--as-text-muted)] hover:bg-[var(--as-surface-2)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card padding="none" className="border-[var(--as-border)] bg-[var(--as-surface)]">
          <div className="flex items-center justify-between border-b border-[var(--as-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-[var(--as-text-muted)]" />
              <h3 className="text-sm font-semibold text-[var(--as-text)]">Campaign shot assets</h3>
            </div>
            <span className="text-xs text-[var(--as-text-subtle)]">{sourceAssets.length} visual files</span>
          </div>

          {sourceAssets.length === 0 ? (
            <div className="p-6 text-sm text-[var(--as-text-muted)]">
              No visual campaign assets found for this filter.
            </div>
          ) : (
            <ul className="max-h-[460px] divide-y divide-[var(--as-border)] overflow-y-auto">
              {sourceAssets.map((source) => (
                <li key={source.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--as-text)]">
                        {source.fileName}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--as-text-muted)]">
                        {source.campaignWfNumber ? `${source.campaignWfNumber} ` : ""}
                        {source.campaignName} · {source.category}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--as-text-subtle)]">
                        Added {fmtRelative(source.createdAt)}
                      </p>
                    </div>

                    {source.ingested ? (
                      <div className="flex items-center gap-2">
                        <span className={statusPillClass("ingested")}>In DAM</span>
                        {source.damAssetId && (
                          <Link
                            href={`/asset-studio?tab=dam`}
                            className="text-xs font-medium text-[var(--as-accent)] hover:text-[var(--as-accent-hover)]"
                          >
                            View
                          </Link>
                        )}
                      </div>
                    ) : canManage ? (
                      <Button
                        size="sm"
                        onClick={() => ingest(source)}
                        loading={busy === `ingest:${source.id}`}
                      >
                        Ingest to DAM
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="none" className="border-[var(--as-border)] bg-[var(--as-surface)]">
          <div className="flex items-center justify-between border-b border-[var(--as-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[var(--as-text-muted)]" />
              <h3 className="text-sm font-semibold text-[var(--as-text)]">DAM lifecycle + versioning</h3>
            </div>
            <span className="text-xs text-[var(--as-text-subtle)]">{assets.length} assets</span>
          </div>

          {assets.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No DAM assets yet"
                description="Ingest a campaign-shot asset to start retouching and versioning."
              />
            </div>
          ) : (
            <ul className="max-h-[460px] divide-y divide-[var(--as-border)] overflow-y-auto">
              {assets.map((asset) => {
                const linkedCampaigns = asset.campaigns ?? [];
                const linkedToSelectedCampaign =
                  campaignId !== "all" && linkedCampaigns.some((c) => c.id === campaignId);

                return (
                  <li key={asset.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      {(asset.fileType || "").startsWith("image/") && asset.fileUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.fileUrl}
                          alt={asset.name}
                          className="h-16 w-16 shrink-0 rounded-md border border-[var(--as-border)] bg-white object-contain"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--as-text)]">{asset.name}</p>
                        <p className="mt-0.5 text-xs text-[var(--as-text-muted)]">
                          {linkedCampaigns.length === 0
                            ? "No campaigns linked"
                            : linkedCampaigns
                                .slice(0, 2)
                                .map((c) => `${c.wfNumber ? `${c.wfNumber} ` : ""}${c.name}`)
                                .join("  •  ")}
                          {linkedCampaigns.length > 2
                            ? `  •  +${linkedCampaigns.length - 2} more`
                            : ""}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={statusPillClass(asset.status)}>
                            {asset.status.replaceAll("_", " ")}
                          </span>
                          <span className={statusPillClass(asset.photoshopStatus)}>
                            Photoshop: {asset.photoshopStatus.replaceAll("_", " ")}
                          </span>
                          <span className={statusPillClass(asset.syncStatus)}>
                            External DAM: {asset.syncStatus.replaceAll("_", " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--as-text-subtle)]">
                          Updated {fmtRelative(asset.updatedAt)} · {asset.versions?.length ?? 0} versions
                        </p>
                        <ProductSkuRow
                          assetId={asset.id}
                          skus={asset.productSkus ?? []}
                          canEdit={canManage}
                          onMutate={mutate}
                        />
                      </div>

                      {canManage && (
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => requestPhotoshop(asset)}
                            loading={busy === `ps:${asset.id}`}
                          >
                            <WandSparkles className="h-3.5 w-3.5" />
                            Edit in Photoshop
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => createVersion(asset)}
                            loading={busy === `ver:${asset.id}`}
                          >
                            Create version
                          </Button>
                          {campaignId !== "all" && (
                            <>
                              {!linkedToSelectedCampaign ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => linkToSelectedCampaign(asset)}
                                  loading={busy === `link:${asset.id}:${campaignId}`}
                                >
                                  Link to campaign
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => unlinkFromSelectedCampaign(asset)}
                                  loading={busy === `unlink:${asset.id}:${campaignId}`}
                                >
                                  Unlink campaign
                                </Button>
                              )}
                            </>
                          )}
                          <select
                            value={asset.status}
                            onChange={(e) => updateStatus(asset, e.target.value as DamAssetStatus)}
                            className="rounded-md border border-[var(--as-border)] bg-[var(--as-surface)] px-2.5 py-1.5 text-xs text-[var(--as-text)]"
                          >
                            {LIFECYCLE_STATUSES.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {asset.versions && asset.versions.length > 0 && (
                      <div className="mt-2 space-y-1 rounded-md border border-[var(--as-border)] bg-[var(--as-surface-2)] p-2">
                        {asset.versions.slice(0, 3).map((version) => (
                          <div key={version.id} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="truncate text-[var(--as-text)]">
                              {version.label || `v${version.versionNumber}`} ·{" "}
                              {version.stage.replaceAll("_", " ")}
                            </span>
                            <span className="text-[var(--as-text-subtle)]">
                              {fmtRelative(version.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function ProductSkuRow({
  assetId,
  skus,
  canEdit,
  onMutate,
}: {
  assetId: string;
  skus: string[];
  canEdit: boolean;
  onMutate: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const { toast } = useToast();

  async function addSku() {
    const sku = draft.trim();
    if (!sku) {
      setAdding(false);
      return;
    }
    try {
      const res = await fetch(`/api/asset-studio/dam-assets/${assetId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast("success", `Tagged ${sku}`);
      setDraft("");
      setAdding(false);
      onMutate();
    } catch {
      toast("error", "Could not tag SKU");
    }
  }

  async function removeSku(sku: string) {
    try {
      const res = await fetch(
        `/api/asset-studio/dam-assets/${assetId}/products?sku=${encodeURIComponent(sku)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await res.text());
      toast("success", `Untagged ${sku}`);
      onMutate();
    } catch {
      toast("error", "Could not untag SKU");
    }
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <Tag className="h-3 w-3 shrink-0 text-[var(--as-text-muted)]" />
      {skus.length === 0 && !adding && (
        <span className="text-[10px] uppercase tracking-wider text-[var(--as-text-subtle)]">
          No SKUs tagged
        </span>
      )}
      {skus.map((sku) => (
        <span
          key={sku}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--as-border)] bg-[var(--as-surface-2)] px-2 py-0.5 text-[11px] text-[var(--as-text)]"
        >
          {sku}
          {canEdit && (
            <button
              type="button"
              onClick={() => removeSku(sku)}
              className="text-[var(--as-text-subtle)] hover:text-[var(--as-text)]"
              aria-label={`Remove ${sku}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      ))}
      {canEdit && (
        adding ? (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={addSku}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            placeholder="SKU or item code"
            className="w-32 rounded-full border border-[var(--as-border)] bg-transparent px-2 py-0.5 text-[11px] text-[var(--as-text)] focus:outline-none focus:border-[var(--as-accent)]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--as-border)] px-2 py-0.5 text-[11px] text-[var(--as-text-muted)] hover:text-[var(--as-text)] hover:border-[var(--as-text-muted)]"
          >
            <Plus className="h-2.5 w-2.5" /> Tag SKU
          </button>
        )
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--as-border)] bg-[var(--as-surface-2)] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--as-text-muted)]">{label}</p>
      <p className="text-lg font-semibold text-[var(--as-text)]">{value.toLocaleString()}</p>
    </div>
  );
}
