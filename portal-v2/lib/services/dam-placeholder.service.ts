import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DamAsset,
  DamAssetCampaignRef,
  DamAssetSource,
  DamAssetStatus,
  DamAssetVersion,
  DamPhotoshopStatus,
  DamSyncStatus,
  UserRole,
} from "@/types/domain";
import { enqueueDamSyncJob } from "@/lib/services/dam-sync.service";
import {
  advanceWorkflowTransition,
  ensureWorkflowInstance,
  syncWorkflowStageFromEntityStatus,
} from "@/lib/services/workflow.service";

const DAM_ASSET_SELECT =
  "*, campaigns(id, wf_number, name, brand), dam_asset_versions(*), dam_asset_campaigns(campaign_id, campaigns(id, wf_number, name, brand))";

function toDamAssetVersion(row: Record<string, unknown>): DamAssetVersion {
  return {
    id: row.id as string,
    damAssetId: row.dam_asset_id as string,
    versionNumber: Number(row.version_number ?? 1),
    label: (row.label as string) ?? "",
    stage: row.stage as DamAssetStatus,
    fileUrl: row.file_url as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    notes: (row.notes as string) ?? "",
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function toCampaignRef(row: Record<string, unknown> | null | undefined): DamAssetCampaignRef | null {
  if (!row || !row.id) return null;
  return {
    id: row.id as string,
    wfNumber: (row.wf_number as string) ?? "",
    name: (row.name as string) ?? "",
    brand: (row.brand as string | null) ?? null,
  };
}

function uniqueCampaigns(campaigns: DamAssetCampaignRef[]): DamAssetCampaignRef[] {
  const seen = new Set<string>();
  const out: DamAssetCampaignRef[] = [];
  for (const campaign of campaigns) {
    if (!campaign.id || seen.has(campaign.id)) continue;
    seen.add(campaign.id);
    out.push(campaign);
  }
  return out;
}

function toSingleJoinRow(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object"
      ? (first as Record<string, unknown>)
      : null;
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function toDamAsset(row: Record<string, unknown>): DamAsset {
  const campaignRow = toCampaignRef(toSingleJoinRow(row.campaigns));
  const versionRows = (row.dam_asset_versions as Record<string, unknown>[] | undefined) ?? [];
  const linkRows = (row.dam_asset_campaigns as Record<string, unknown>[] | undefined) ?? [];

  const linkedCampaigns = uniqueCampaigns(
    linkRows
      .map((link) => toCampaignRef(link.campaigns as Record<string, unknown> | null | undefined))
      .filter((campaign): campaign is DamAssetCampaignRef => Boolean(campaign))
  );

  const campaigns =
    linkedCampaigns.length > 0
      ? linkedCampaigns
      : campaignRow
        ? [campaignRow]
        : [];

  const versions = versionRows
    .map(toDamAssetVersion)
    .sort((a, b) => b.versionNumber - a.versionNumber);

  return {
    id: row.id as string,
    campaignId: (row.campaign_id as string | null) ?? campaigns[0]?.id ?? null,
    sourceCampaignAssetId: (row.source_campaign_asset_id as string | null) ?? null,
    name: row.name as string,
    fileUrl: row.file_url as string,
    fileType: (row.file_type as string) ?? "",
    status: row.status as DamAssetStatus,
    photoshopStatus: row.photoshop_status as DamPhotoshopStatus,
    photoshopNote: (row.photoshop_note as string) ?? "",
    lastPhotoshopRequestAt: (row.last_photoshop_request_at as string | null) ?? null,
    retouchingNotes: (row.retouching_notes as string) ?? "",
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    externalDamId: (row.external_dam_id as string | null) ?? null,
    externalDamSystem: (row.external_dam_system as string) ?? "placeholder",
    syncStatus: (row.sync_status as DamSyncStatus) ?? "pending_sync",
    lastSyncedAt: (row.last_synced_at as string | null) ?? null,
    syncError: (row.sync_error as string) ?? "",
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    campaign: campaigns[0] ?? null,
    campaigns,
    versions,
  };
}

function isLikelyVisualAsset(fileType: string, fileName: string): boolean {
  if (fileType.startsWith("image/") || fileType.startsWith("video/")) return true;
  return /\.(png|jpe?g|gif|webp|svg|heic|heif|mp4|mov|avi)$/i.test(fileName);
}

async function linkDamAssetToCampaign(input: {
  damAssetId: string;
  campaignId: string;
  linkedBy?: string;
}): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("dam_asset_campaigns").upsert(
    {
      dam_asset_id: input.damAssetId,
      campaign_id: input.campaignId,
      linked_by: input.linkedBy ?? null,
    },
    {
      onConflict: "dam_asset_id,campaign_id",
      ignoreDuplicates: true,
    }
  );

  if (error) throw error;

  await syncLegacyCampaignId(input.damAssetId);
}

async function unlinkDamAssetFromCampaign(input: {
  damAssetId: string;
  campaignId: string;
}): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("dam_asset_campaigns")
    .delete()
    .eq("dam_asset_id", input.damAssetId)
    .eq("campaign_id", input.campaignId);

  if (error) throw error;

  await syncLegacyCampaignId(input.damAssetId);
}

async function syncLegacyCampaignId(damAssetId: string): Promise<void> {
  const db = createAdminClient();

  const { data: firstLink, error: linkError } = await db
    .from("dam_asset_campaigns")
    .select("campaign_id")
    .eq("dam_asset_id", damAssetId)
    .order("linked_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (linkError) throw linkError;

  const { error: updateError } = await db
    .from("dam_assets")
    .update({
      campaign_id: (firstLink?.campaign_id as string | null) ?? null,
    })
    .eq("id", damAssetId);

  if (updateError) throw updateError;
}

export async function listDamAssets(filters?: {
  campaignId?: string;
  status?: DamAssetStatus;
  limit?: number;
}): Promise<DamAsset[]> {
  const db = createAdminClient();

  let filteredAssetIds: string[] | null = null;
  if (filters?.campaignId) {
    const { data: links, error: linkError } = await db
      .from("dam_asset_campaigns")
      .select("dam_asset_id")
      .eq("campaign_id", filters.campaignId);

    if (linkError) throw linkError;

    filteredAssetIds = Array.from(
      new Set(
        (links ?? [])
          .map((row) => row.dam_asset_id as string | null)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (filteredAssetIds.length === 0) return [];
  }

  let query = db.from("dam_assets").select(DAM_ASSET_SELECT).order("created_at", { ascending: false });

  if (filteredAssetIds) query = query.in("id", filteredAssetIds);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.limit) query = query.limit(Math.max(1, Math.trunc(filters.limit)));

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => toDamAsset(row as Record<string, unknown>));
}

export async function getDamAsset(id: string): Promise<DamAsset | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("dam_assets")
    .select(DAM_ASSET_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return toDamAsset(data as Record<string, unknown>);
}

export async function listDamSources(filters?: {
  campaignId?: string;
  limit?: number;
}): Promise<DamAssetSource[]> {
  const db = createAdminClient();

  let sourceQuery = db
    .from("campaign_assets")
    .select(
      "id, campaign_id, file_name, file_url, file_type, file_size, category, created_at, campaigns(name, wf_number)"
    )
    .order("created_at", { ascending: false });

  if (filters?.campaignId) sourceQuery = sourceQuery.eq("campaign_id", filters.campaignId);
  if (filters?.limit) sourceQuery = sourceQuery.limit(Math.max(1, Math.trunc(filters.limit)));

  const { data: sourceRows, error: sourceError } = await sourceQuery;
  if (sourceError) throw sourceError;

  const visualRows = (sourceRows ?? []).filter((row) =>
    isLikelyVisualAsset((row.file_type as string) ?? "", (row.file_name as string) ?? "")
  );

  const sourceIds = visualRows.map((row) => row.id as string);

  let ingestedMap = new Map<string, string>();
  if (sourceIds.length > 0) {
    const { data: ingestedRows, error: ingestedError } = await db
      .from("dam_assets")
      .select("id, source_campaign_asset_id")
      .in("source_campaign_asset_id", sourceIds);

    if (ingestedError) throw ingestedError;
    ingestedMap = new Map(
      (ingestedRows ?? [])
        .filter((row) => Boolean(row.source_campaign_asset_id))
        .map((row) => [row.source_campaign_asset_id as string, row.id as string])
    );
  }

  return visualRows.map((row) => {
    const campaign = toSingleJoinRow(row.campaigns);
    const sourceId = row.id as string;
    const damAssetId = ingestedMap.get(sourceId) ?? null;

    return {
      id: sourceId,
      campaignId: row.campaign_id as string,
      campaignName: (campaign?.name as string) ?? "",
      campaignWfNumber: (campaign?.wf_number as string) ?? "",
      fileName: (row.file_name as string) ?? "",
      fileUrl: (row.file_url as string) ?? "",
      fileType: (row.file_type as string) ?? "",
      fileSize: Number(row.file_size ?? 0),
      category: row.category as DamAssetSource["category"],
      createdAt: row.created_at as string,
      ingested: Boolean(damAssetId),
      damAssetId,
    };
  });
}

export async function ingestCampaignAssetToDam(input: {
  campaignAssetId: string;
  createdBy: string;
}): Promise<DamAsset> {
  const db = createAdminClient();

  const { data: sourceRow, error: sourceError } = await db
    .from("campaign_assets")
    .select("id, campaign_id, file_name, file_url, file_type, file_size, category")
    .eq("id", input.campaignAssetId)
    .single();

  if (sourceError || !sourceRow) {
    throw new Error("Campaign asset not found");
  }

  const { data: existing } = await db
    .from("dam_assets")
    .select("id")
    .eq("source_campaign_asset_id", input.campaignAssetId)
    .maybeSingle();

  if (existing?.id) {
    if (sourceRow.campaign_id) {
      await linkDamAssetToCampaign({
        damAssetId: existing.id,
        campaignId: sourceRow.campaign_id as string,
        linkedBy: input.createdBy,
      });
    }

    const current = await getDamAsset(existing.id);
    if (!current) throw new Error("DAM asset already exists but could not be loaded");

    await ensureWorkflowInstance({
      entityType: "dam_asset",
      entityId: existing.id,
      createdBy: input.createdBy,
      campaignId: (sourceRow.campaign_id as string | null) ?? current.campaignId ?? null,
      initialStage: current.status,
    });

    return current;
  }

  const { data: damRow, error: damError } = await db
    .from("dam_assets")
    .insert({
      campaign_id: sourceRow.campaign_id,
      source_campaign_asset_id: sourceRow.id,
      name: sourceRow.file_name,
      file_url: sourceRow.file_url,
      file_type: sourceRow.file_type ?? "",
      status: "ingested",
      photoshop_status: "not_requested",
      external_dam_system: "placeholder",
      sync_status: "pending_sync",
      metadata: {
        source: "campaign_assets",
        source_category: sourceRow.category,
        source_file_size: Number(sourceRow.file_size ?? 0),
        authoritative_source: "external_dam",
      },
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (damError || !damRow) throw damError ?? new Error("Failed to create DAM asset");

  const { error: versionError } = await db.from("dam_asset_versions").insert({
    dam_asset_id: damRow.id,
    version_number: 1,
    label: "v1 ingest",
    stage: "ingested",
    file_url: sourceRow.file_url,
    metadata: {
      ingest_source: "campaign_assets",
      source_campaign_asset_id: sourceRow.id,
    },
    notes: "Ingested from campaign production asset",
    created_by: input.createdBy,
  });

  if (versionError) throw versionError;

  if (sourceRow.campaign_id) {
    await linkDamAssetToCampaign({
      damAssetId: damRow.id,
      campaignId: sourceRow.campaign_id as string,
      linkedBy: input.createdBy,
    });
  }

  await ensureWorkflowInstance({
    entityType: "dam_asset",
    entityId: damRow.id as string,
    createdBy: input.createdBy,
    campaignId: (sourceRow.campaign_id as string | null) ?? null,
    initialStage: "ingested",
  });

  const asset = await getDamAsset(damRow.id);
  if (!asset) throw new Error("Created DAM asset could not be loaded");
  return asset;
}

export async function updateDamAsset(input: {
  damAssetId: string;
  action?: "request_photoshop" | "link_campaign" | "unlink_campaign";
  campaignIdForAction?: string;
  status?: DamAssetStatus;
  photoshopStatus?: DamPhotoshopStatus;
  photoshopNote?: string;
  retouchingNotes?: string;
  actorId?: string | null;
  actorRole?: UserRole | null;
}): Promise<DamAsset> {
  const db = createAdminClient();

  const current = await getDamAsset(input.damAssetId);
  if (!current) throw new Error("DAM asset not found");

  const patch: Record<string, unknown> = {};
  let nextLifecycleStatus: DamAssetStatus | null = null;

  if (input.action === "request_photoshop") {
    patch.photoshop_status = "requested";
    patch.last_photoshop_request_at = new Date().toISOString();
    if (current.status === "ingested" && !input.status) {
      nextLifecycleStatus = "retouching";
    }
  }

  if (input.status) nextLifecycleStatus = input.status;
  if (input.photoshopStatus) patch.photoshop_status = input.photoshopStatus;
  if (input.photoshopNote !== undefined) patch.photoshop_note = input.photoshopNote;
  if (input.retouchingNotes !== undefined) patch.retouching_notes = input.retouchingNotes;

  if (
    input.photoshopStatus === "completed" &&
    !input.status &&
    current.status === "retouching"
  ) {
    nextLifecycleStatus = "retouched";
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("dam_assets").update(patch).eq("id", input.damAssetId);
    if (error) throw error;
  }

  if (nextLifecycleStatus && nextLifecycleStatus !== current.status) {
    if (input.actorId && input.actorRole) {
      await advanceWorkflowTransition({
        entityType: "dam_asset",
        entityId: input.damAssetId,
        toStage: nextLifecycleStatus,
        actorId: input.actorId,
        actorRole: input.actorRole,
        reason:
          input.action === "request_photoshop"
            ? "Photoshop handoff requested"
            : "Lifecycle status updated",
        metadata: {
          source: "dam-placeholder.updateDamAsset",
        },
      });
    } else {
      const { error } = await db
        .from("dam_assets")
        .update({ status: nextLifecycleStatus })
        .eq("id", input.damAssetId);

      if (error) throw error;

      await syncWorkflowStageFromEntityStatus({
        entityType: "dam_asset",
        entityId: input.damAssetId,
        stage: nextLifecycleStatus,
        reason: "Lifecycle status synchronized from legacy update path",
        metadata: {
          source: "dam-placeholder.updateDamAsset.fallback",
        },
      });
    }
  } else {
    await ensureWorkflowInstance({
      entityType: "dam_asset",
      entityId: input.damAssetId,
      createdBy: input.actorId ?? null,
      initialStage: current.status,
      campaignId: current.campaignId,
    });
  }

  if (input.action === "link_campaign") {
    if (!input.campaignIdForAction) throw new Error("campaignIdForAction is required");
    await linkDamAssetToCampaign({
      damAssetId: input.damAssetId,
      campaignId: input.campaignIdForAction,
    });
  }

  if (input.action === "unlink_campaign") {
    if (!input.campaignIdForAction) throw new Error("campaignIdForAction is required");
    await unlinkDamAssetFromCampaign({
      damAssetId: input.damAssetId,
      campaignId: input.campaignIdForAction,
    });
  }

  const next = await getDamAsset(input.damAssetId);
  if (!next) throw new Error("Updated DAM asset could not be loaded");
  return next;
}

export async function createDamAssetVersion(input: {
  damAssetId: string;
  label?: string;
  notes?: string;
  stage?: DamAssetStatus;
  fileUrl?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdByRole?: UserRole | null;
}): Promise<DamAssetVersion> {
  const db = createAdminClient();

  const current = await getDamAsset(input.damAssetId);
  if (!current) throw new Error("DAM asset not found");

  const { data: latestVersionRow } = await db
    .from("dam_asset_versions")
    .select("version_number")
    .eq("dam_asset_id", input.damAssetId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = Number(latestVersionRow?.version_number ?? 0) + 1;
  const stage = input.stage ?? current.status;
  const fileUrl = input.fileUrl ?? current.fileUrl;

  const { data: versionRow, error: versionError } = await db
    .from("dam_asset_versions")
    .insert({
      dam_asset_id: input.damAssetId,
      version_number: nextVersion,
      label: input.label?.trim() || `v${nextVersion}`,
      stage,
      file_url: fileUrl,
      metadata: input.metadata ?? {},
      notes: input.notes ?? "",
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (versionError || !versionRow) {
    throw versionError ?? new Error("Failed to create DAM asset version");
  }

  let lifecycleUpdatedViaWorkflow = false;
  if (stage !== current.status) {
    if (input.createdByRole) {
      await advanceWorkflowTransition({
        entityType: "dam_asset",
        entityId: input.damAssetId,
        toStage: stage,
        actorId: input.createdBy,
        actorRole: input.createdByRole,
        reason: "Lifecycle advanced during version creation",
        metadata: {
          source: "dam-placeholder.createDamAssetVersion",
          versionId: versionRow.id as string,
          versionNumber: nextVersion,
        },
      });
      lifecycleUpdatedViaWorkflow = true;
    } else {
      await syncWorkflowStageFromEntityStatus({
        entityType: "dam_asset",
        entityId: input.damAssetId,
        stage,
        actorId: input.createdBy,
        reason: "Lifecycle stage synchronized during version creation",
        metadata: {
          source: "dam-placeholder.createDamAssetVersion.fallback",
        },
      });
    }
  } else {
    await ensureWorkflowInstance({
      entityType: "dam_asset",
      entityId: input.damAssetId,
      createdBy: input.createdBy,
      initialStage: current.status,
      campaignId: current.campaignId,
    });
  }

  const assetPatch: Record<string, unknown> = {
    sync_status: "pending_sync",
    sync_error: "",
  };
  if (!lifecycleUpdatedViaWorkflow && stage !== current.status) {
    assetPatch.status = stage;
  }
  if (input.fileUrl) assetPatch.file_url = input.fileUrl;

  const { error: assetError } = await db
    .from("dam_assets")
    .update(assetPatch)
    .eq("id", input.damAssetId);

  if (assetError) throw assetError;

  await enqueueDamSyncJob({
    damAssetId: input.damAssetId,
    damAssetVersionId: versionRow.id as string,
    createdBy: input.createdBy,
    actorRole: input.createdByRole ?? null,
    reason: "Version created in DAM placeholder",
    metadata: {
      source: "dam-placeholder.createDamAssetVersion",
      versionNumber: nextVersion,
      stage,
    },
  });

  return toDamAssetVersion(versionRow as Record<string, unknown>);
}
