export interface DamSyncAssetPayload {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  status: string;
  metadata: Record<string, unknown>;
  externalDamSystem: string;
  externalDamId: string | null;
}

export interface DamSyncVersionPayload {
  id: string;
  damAssetId: string;
  versionNumber: number;
  label: string;
  stage: string;
  fileUrl: string;
  metadata: Record<string, unknown>;
  notes: string;
  createdAt: string;
}

export interface DamSyncContext {
  jobId: string;
  jobItemId: string;
  idempotencyKey: string;
  attempt: number;
}

export interface DamSyncResult {
  externalDamId: string;
  externalSystem: string;
  syncedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ExternalDamAdapter {
  readonly provider: string;
  syncAssetVersion(input: {
    asset: DamSyncAssetPayload;
    version: DamSyncVersionPayload;
    context: DamSyncContext;
  }): Promise<DamSyncResult>;
}

class PlaceholderExternalDamAdapter implements ExternalDamAdapter {
  readonly provider = "placeholder";

  async syncAssetVersion(input: {
    asset: DamSyncAssetPayload;
    version: DamSyncVersionPayload;
    context: DamSyncContext;
  }): Promise<DamSyncResult> {
    const externalDamId = `placeholder:${input.asset.id}:v${input.version.versionNumber}`;
    return {
      externalDamId,
      externalSystem: this.provider,
      syncedAt: new Date().toISOString(),
      metadata: {
        source: "placeholder_adapter",
        idempotencyKey: input.context.idempotencyKey,
        fileUrl: input.version.fileUrl,
      },
    };
  }
}

const adapterRegistry: Record<string, ExternalDamAdapter> = {
  placeholder: new PlaceholderExternalDamAdapter(),
};

export function getExternalDamAdapter(system: string | null | undefined): ExternalDamAdapter {
  if (!system) return adapterRegistry.placeholder;
  return adapterRegistry[system] ?? adapterRegistry.placeholder;
}
