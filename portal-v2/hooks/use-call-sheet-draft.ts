"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type { CallSheetContent, CallSheetRow } from "@/types/domain";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Request failed: ${r.status}`);
  return r.json();
};

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface UseCallSheetDraftResult {
  sheet: CallSheetRow | null;
  content: CallSheetContent | null;
  isLoading: boolean;
  saveState: SaveState;
  lastSavedAt: Date | null;
  updateContent: (patch: Partial<CallSheetContent>) => void;
  publish: () => Promise<{ vNumber: number } | null>;
  publishError: string | null;
  refresh: () => void;
}

/**
 * Loads the draft call sheet for a campaign × shoot_date, with
 * debounced autosave. Mutations mutate local state immediately
 * (optimistic) and flush to the server ~800ms after the last edit.
 */
export function useCallSheetDraft(
  campaignId: string | null,
  shootDateId: string | null
): UseCallSheetDraftResult {
  const swrKey =
    campaignId && shootDateId
      ? `/api/call-sheets/by-shoot-date?campaignId=${campaignId}&shootDateId=${shootDateId}`
      : null;

  const { data, isLoading, mutate } = useSWR<CallSheetRow>(swrKey, fetcher, {
    revalidateOnFocus: false,
  });

  const [localContent, setLocalContent] = useState<CallSheetContent | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Partial<CallSheetContent>>({});
  const sheetIdRef = useRef<string | null>(null);

  // Reset local state whenever the underlying sheet (shoot date) changes
  useEffect(() => {
    if (data) {
      setLocalContent(data.contentDraft);
      sheetIdRef.current = data.id;
      setSaveState("idle");
      pendingPatchRef.current = {};
    }
  }, [data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced flush
  const flush = useCallback(async () => {
    const id = sheetIdRef.current;
    const patch = pendingPatchRef.current;
    if (!id || Object.keys(patch).length === 0) {
      setSaveState("idle");
      return;
    }
    pendingPatchRef.current = {};
    setSaveState("saving");
    try {
      const r = await fetch(`/api/call-sheets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(`Save failed: ${r.status}`);
      const updated = (await r.json()) as CallSheetRow;
      setLastSavedAt(new Date());
      setSaveState("saved");
      // Re-sync SWR cache without triggering a refetch
      mutate(updated, false);
    } catch {
      setSaveState("error");
    }
  }, [mutate]);

  const updateContent = useCallback(
    (patch: Partial<CallSheetContent>) => {
      setLocalContent((prev) => {
        if (!prev) return prev;
        return { ...prev, ...patch };
      });
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      setSaveState("dirty");

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, 800);
    },
    [flush]
  );

  // Flush on unmount / dependency change
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        void flush();
      }
    };
  }, [flush]);

  const publish = useCallback(async (): Promise<{ vNumber: number } | null> => {
    const id = sheetIdRef.current;
    if (!id) return null;
    // Flush any pending edits first
    if (pendingPatchRef.current && Object.keys(pendingPatchRef.current).length > 0) {
      await flush();
    }
    setPublishError(null);
    try {
      const r = await fetch(`/api/call-sheets/${id}/publish`, { method: "POST" });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        setPublishError(err.error || "Publish failed");
        return null;
      }
      const version = (await r.json()) as { vNumber: number };
      await mutate();
      return { vNumber: version.vNumber };
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Publish failed");
      return null;
    }
  }, [flush, mutate]);

  const refresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  return useMemo(
    () => ({
      sheet: data ?? null,
      content: localContent,
      isLoading,
      saveState,
      lastSavedAt,
      updateContent,
      publish,
      publishError,
      refresh,
    }),
    [data, localContent, isLoading, saveState, lastSavedAt, updateContent, publish, publishError, refresh]
  );
}
