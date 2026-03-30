"use client";

import { createContext, useContext } from "react";
import { useMenagerie } from "@/hooks/use-menagerie";
import type { CreatureKey } from "@/lib/constants/menagerie";

interface MenagerieContext {
  collection: { creature_key: CreatureKey; discovered_at: string }[];
  hasCollectedCreature: (key: CreatureKey) => boolean;
  isDiscovered: (key: CreatureKey) => boolean;
  discoverCreature: (key: CreatureKey) => Promise<void>;
  isLoading: boolean;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  resetCollection: () => Promise<void>;
  releaseKey: number;
  releaseCreatures: () => void;
  releasedCreatures: CreatureKey[];
  visuallyReleased: boolean;
  discoveredCount: number;
  zookeeperRequest: number;
  requestZookeeper: () => void;
}

const MenagerieCtx = createContext<MenagerieContext | null>(null);

export function MenagerieProvider({ children }: { children: React.ReactNode }) {
  const menagerie = useMenagerie();

  return (
    <MenagerieCtx.Provider value={menagerie}>{children}</MenagerieCtx.Provider>
  );
}

export function useMenagerieContext() {
  const ctx = useContext(MenagerieCtx);
  if (!ctx) throw new Error("useMenagerieContext must be inside MenagerieProvider");
  return ctx;
}
