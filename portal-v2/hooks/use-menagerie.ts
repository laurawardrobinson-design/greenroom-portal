"use client";

import useSWR from "swr";
import { useCallback, useMemo, useState } from "react";
import type { CreatureKey } from "@/lib/constants/menagerie";

const EMPTY_COLLECTION: Discovery[] = [];

interface Discovery {
  creature_key: CreatureKey;
  discovered_at: string;
}

function upsertDiscovery(
  collection: Discovery[],
  key: CreatureKey,
  discoveredAt: string
) {
  const existingIndex = collection.findIndex((d) => d.creature_key === key);

  if (existingIndex === -1) {
    return [...collection, { creature_key: key, discovered_at: discoveredAt }];
  }

  return collection;
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export function useMenagerie(userId: string | null) {
  // Scope cache key to the current user so data doesn't leak across sessions
  const { data, isLoading, mutate } = useSWR<Discovery[]>(
    userId ? `/api/menagerie?uid=${userId}` : null,
    fetcher
  );

  const collection = data ?? EMPTY_COLLECTION;
  const [releasedCreatures, setReleasedCreatures] = useState<CreatureKey[]>([]);
  const activeReleasedCreatures = useMemo(
    () =>
      releasedCreatures.filter((key) =>
        collection.some((discovery) => discovery.creature_key === key)
      ),
    [collection, releasedCreatures]
  );

  const hasCollectedCreature = useCallback(
    (key: CreatureKey) => collection.some((d) => d.creature_key === key),
    [collection]
  );

  const isDiscovered = useCallback(
    (key: CreatureKey) =>
      hasCollectedCreature(key) && !activeReleasedCreatures.includes(key),
    [activeReleasedCreatures, hasCollectedCreature]
  );

  const discoverCreature = useCallback(
    async (key: CreatureKey) => {
      const alreadyCollected = hasCollectedCreature(key);
      const wasReleased = activeReleasedCreatures.includes(key);

      if (alreadyCollected && !wasReleased) return;

      const discoveredAt = new Date().toISOString();
      const optimistic = upsertDiscovery(collection, key, discoveredAt);
      const previousReleased = activeReleasedCreatures;

      if (wasReleased) {
        setReleasedCreatures((previous) =>
          previous.filter((creature) => creature !== key)
        );
      }

      try {
        await mutate(
          async () => {
            const response = await fetch("/api/menagerie", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ creatureKey: key }),
            });

            if (!response.ok) {
              throw new Error("Failed to discover creature");
            }

            return optimistic;
          },
          {
            optimisticData: optimistic,
            rollbackOnError: true,
            revalidate: false,
          }
        );
      } catch (error) {
        setReleasedCreatures(previousReleased);
        throw error;
      }
    },
    [activeReleasedCreatures, collection, hasCollectedCreature, mutate]
  );

  // Release key — increments when creatures are released to roam again
  const [releaseKey, setReleaseKey] = useState(0);
  const visuallyReleased = activeReleasedCreatures.length > 0;
  const discoveredCount = collection.length - activeReleasedCreatures.length;
  const releaseCreatures = useCallback(() => {
    if (collection.length === 0) return;
    setReleaseKey((k) => k + 1);
    setReleasedCreatures(collection.map((discovery) => discovery.creature_key));
  }, [collection]);

  // Zookeeper request — increments to signal GatorEasterEgg to play the animation
  const [zookeeperRequest, setZookeeperRequest] = useState(0);
  const requestZookeeper = useCallback(() => setZookeeperRequest((r) => r + 1), []);

  // Enabled is session-only — always false on login, set true when gator is triggered.
  // This ensures the menagerie is always hidden on fresh login regardless of DB state.
  const [enabled, setEnabled] = useState(false);
  const activateMenagerie = useCallback(() => setEnabled(true), []);

  // Zookeeper — wipe collection and deactivate for this session
  const resetCollection = useCallback(async () => {
    const previousReleased = activeReleasedCreatures;
    const previousEnabled = enabled;
    setReleasedCreatures([]);
    setEnabled(false);
    try {
      await mutate(
        async () => {
          const response = await fetch("/api/menagerie", { method: "DELETE" });

          if (!response.ok) {
            throw new Error("Failed to reset menagerie");
          }

          return [];
        },
        { optimisticData: [], rollbackOnError: true, revalidate: false }
      );
    } catch (error) {
      setReleasedCreatures(previousReleased);
      setEnabled(previousEnabled);
      throw error;
    }
  }, [activeReleasedCreatures, enabled, mutate]);

  return {
    collection,
    hasCollectedCreature,
    isDiscovered,
    discoverCreature,
    isLoading,
    enabled,
    activateMenagerie,
    resetCollection,
    releaseKey,
    releaseCreatures,
    releasedCreatures: activeReleasedCreatures,
    visuallyReleased,
    discoveredCount,
    zookeeperRequest,
    requestZookeeper,
  };
}
