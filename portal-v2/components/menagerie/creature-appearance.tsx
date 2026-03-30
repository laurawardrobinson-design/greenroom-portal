"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useMenagerieContext } from "./menagerie-provider";
import { GatorSvg, PeacockSvg, MothSvg, RaccoonSvg } from "./creatures";
import { CREATURES, type CreatureKey } from "@/lib/constants/menagerie";

const CREATURE_SVG: Record<CreatureKey, React.FC<{ className?: string }>> = {
  gator: GatorSvg,
  peacock: PeacockSvg,
  moth: MothSvg,
  raccoon: RaccoonSvg,
};

const CREATURE_SIZE: Record<CreatureKey, string> = {
  gator: "h-8 w-12",
  peacock: "h-10 w-14",
  moth: "h-10 w-12",
  raccoon: "h-11 w-12",
};

// Duration of each creature's full scene (ms)
const SCENE_DURATION: Record<CreatureKey, number> = {
  gator: 5000,
  peacock: 3000,
  moth: 3000,
  raccoon: 3000,
};

export interface TriggerPosition {
  x: number;
  y: number;
}

interface CreatureAppearanceProps {
  creature: CreatureKey;
  position?: TriggerPosition;
  onDone?: () => void;
}

export function CreatureAppearance({ creature, position, onDone }: CreatureAppearanceProps) {
  const { isDiscovered, discoverCreature } = useMenagerieContext();
  const [phase, setPhase] = useState<"enter" | "perform" | "exit">("enter");
  const didDiscover = useRef(false);
  const handleDone = useEffectEvent(() => onDone?.());

  const SvgComponent = CREATURE_SVG[creature];
  const sizeClass = CREATURE_SIZE[creature];
  const creatureData = CREATURES.find((c) => c.key === creature);
  const isNew = !isDiscovered(creature);
  const [showToast] = useState(isNew);

  // Position in white space near trigger word (safe for SSR)
  const clampedPos = useMemo(() => {
    if (typeof window === "undefined") {
      return { x: 0, y: 0 };
    }
    const pos = position || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = Math.max(80, Math.min(pos.x, vw - 80));
    // Place below the trigger word in white space; if near bottom, place above
    const y = pos.y > vh - 160 ? pos.y - 60 : pos.y + 30;
    return { x, y: Math.max(40, Math.min(y, vh - 80)) };
  }, [position]);

  useEffect(() => {
    if (isNew && !didDiscover.current) {
      didDiscover.current = true;
      discoverCreature(creature);
    }
  }, [isNew, creature, discoverCreature]);

  // Scene timeline: enter → perform → exit → done
  // Uses ref for onDone to avoid re-running on callback identity change
  useEffect(() => {
    const durations = {
      enter: 600,
      perform: Math.max(SCENE_DURATION[creature] - 1200, 200),
      exit: 600,
    };

    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => {
      setPhase("perform");

      timers.push(setTimeout(() => {
        setPhase("exit");

        timers.push(setTimeout(() => {
          handleDone();
        }, durations.exit));
      }, durations.perform));
    }, durations.enter));

    return () => timers.forEach(clearTimeout);
  }, [creature]);

  // No position = fall back to generic walk (gator uses this)
  if (!position && creature === "gator") {
    return (
      <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
        <div className="creature-walk absolute bottom-16" style={{ left: "-60px" }}>
          <div className="gator-waddle">
            <SvgComponent className={sizeClass} />
          </div>
        </div>
        {showToast && creatureData && <DiscoveryToast name={creatureData.name} />}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {creature === "peacock" && (
        <PeacockScene x={clampedPos.x} y={clampedPos.y} phase={phase} SvgComponent={SvgComponent} sizeClass={sizeClass} />
      )}
      {creature === "moth" && (
        <MothScene x={clampedPos.x} y={clampedPos.y} phase={phase} SvgComponent={SvgComponent} sizeClass={sizeClass} />
      )}
      {creature === "raccoon" && (
        <RaccoonScene x={clampedPos.x} y={clampedPos.y} phase={phase} SvgComponent={SvgComponent} sizeClass={sizeClass} />
      )}

      {showToast && creatureData && <DiscoveryToast name={creatureData.name} />}
    </div>
  );
}

// --- Discovery toast ---
function DiscoveryToast({ name }: { name: string }) {
  return (
    <div className="discovery-toast fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-sidebar text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
      <span className="discovery-sparkle text-primary text-lg">✦</span>
      <span>
        You discovered{" "}
        <span className="font-semibold text-primary">{name}</span>
      </span>
    </div>
  );
}

// --- Scene components ---
interface SceneProps {
  x: number;
  y: number;
  phase: "enter" | "perform" | "exit";
  SvgComponent: React.FC<{ className?: string }>;
  sizeClass: string;
}

function PeacockScene({ x, y, phase, sizeClass }: Omit<SceneProps, "SvgComponent">) {
  return (
    <div
      className={`absolute ${
        phase === "enter" ? "peacock-appear" : ""
      } ${phase === "exit" ? "peacock-disappear" : ""}`}
      style={{ left: x + 4, top: y - 20 }}
    >
      <div className={phase === "perform" ? "peacock-card-dance-discovery" : ""}>
        <PeacockSvg
          className={sizeClass}
          tailClassName="peacock-tail-sway-discovery"
        />
      </div>
    </div>
  );
}

function MothScene({ x, y, phase, SvgComponent, sizeClass }: SceneProps) {
  return (
    <div
      className={`absolute ${
        phase === "enter" ? "moth-arrive" : ""
      } ${phase === "perform" ? "moth-orbit" : ""} ${
        phase === "exit" ? "moth-flyoff" : ""
      }`}
      style={{ left: x + 4, top: y - 30 }}
    >
      <div className="moth-flutter">
        <SvgComponent className={sizeClass} />
      </div>
    </div>
  );
}

function RaccoonScene({ x, y, phase, SvgComponent, sizeClass }: SceneProps) {
  return (
    <div
      className={`absolute ${
        phase === "enter" ? "raccoon-enter" : ""
      } ${phase === "perform" ? "raccoon-dig" : ""} ${
        phase === "exit" ? "raccoon-exit" : ""
      }`}
      style={{ left: x + 4, top: y - 16 }}
    >
      <div className="raccoon-rummage">
        <SvgComponent className={sizeClass} />
      </div>
    </div>
  );
}
