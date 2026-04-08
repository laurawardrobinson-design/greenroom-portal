import {
  WORKFLOW_FEATURE_FLAGS,
  type WorkflowFeatureFlagKey,
} from "@/lib/constants/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";

const FLAG_CACHE_TTL_MS = 30_000;

type FeatureFlagRow = {
  key: string;
  enabled: boolean;
};

type FeatureFlagCacheEntry = {
  enabled: boolean;
  expiresAt: number;
};

const flagCache = new Map<WorkflowFeatureFlagKey, FeatureFlagCacheEntry>();

function getEnvKey(flag: WorkflowFeatureFlagKey): string {
  return `FEATURE_FLAG_${flag.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
}

function parseEnvBoolean(raw: string | undefined): boolean | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();

  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }

  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }

  return null;
}

function getEnvOverride(flag: WorkflowFeatureFlagKey): boolean | null {
  return parseEnvBoolean(process.env[getEnvKey(flag)]);
}

export function clearWorkflowFeatureFlagCache(): void {
  flagCache.clear();
}

export async function isWorkflowFeatureEnabled(
  flag: WorkflowFeatureFlagKey,
  options?: {
    defaultValue?: boolean;
    bypassCache?: boolean;
  }
): Promise<boolean> {
  const defaultValue = options?.defaultValue ?? false;

  const envOverride = getEnvOverride(flag);
  if (envOverride !== null) {
    return envOverride;
  }

  if (!options?.bypassCache) {
    const cached = flagCache.get(flag);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.enabled;
    }
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("feature_flags")
    .select("enabled")
    .eq("key", flag)
    .maybeSingle();

  const enabled = error ? defaultValue : Boolean(data?.enabled ?? defaultValue);

  if (error) {
    console.warn("[FeatureFlags] Failed to read flag from database", {
      flag,
      error: error.message,
    });
  }

  flagCache.set(flag, {
    enabled,
    expiresAt: Date.now() + FLAG_CACHE_TTL_MS,
  });

  return enabled;
}

export async function getWorkflowFeatureFlagSnapshot(
  flags: readonly WorkflowFeatureFlagKey[] = WORKFLOW_FEATURE_FLAGS
): Promise<Record<WorkflowFeatureFlagKey, boolean>> {
  const snapshot = {} as Record<WorkflowFeatureFlagKey, boolean>;
  const toFetch: WorkflowFeatureFlagKey[] = [];

  for (const flag of flags) {
    const envOverride = getEnvOverride(flag);
    if (envOverride !== null) {
      snapshot[flag] = envOverride;
      continue;
    }

    snapshot[flag] = false;
    toFetch.push(flag);
  }

  if (toFetch.length === 0) {
    return snapshot;
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("feature_flags")
    .select("key, enabled")
    .in("key", [...toFetch]);

  if (error) {
    console.warn("[FeatureFlags] Failed to load snapshot from database", {
      flags: toFetch,
      error: error.message,
    });

    return snapshot;
  }

  for (const row of (data || []) as FeatureFlagRow[]) {
    const key = row.key as WorkflowFeatureFlagKey;
    if (!toFetch.includes(key)) {
      continue;
    }

    const enabled = Boolean(row.enabled);
    snapshot[key] = enabled;

    flagCache.set(key, {
      enabled,
      expiresAt: Date.now() + FLAG_CACHE_TTL_MS,
    });
  }

  return snapshot;
}
