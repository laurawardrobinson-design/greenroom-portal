"use client";

import Image from "next/image";
import { useState } from "react";
import { useMenagerieContext } from "./menagerie-provider";
import { GatorSvg, PeacockSvg, MothSvg, RaccoonSvg } from "./creatures";
import { CREATURES, type CreatureKey } from "@/lib/constants/menagerie";
import { X } from "lucide-react";
import { format, parseISO } from "date-fns";

const CREATURE_SVG: Record<CreatureKey, React.FC<{ className?: string }>> = {
  gator: GatorSvg,
  peacock: PeacockSvg,
  moth: MothSvg,
  raccoon: RaccoonSvg,
};

export function TrophyCase() {
  const {
    collection,
    hasCollectedCreature,
    isDiscovered,
    enabled,
    requestZookeeper,
    releaseCreatures,
    discoveredCount,
  } = useMenagerieContext();
  const [open, setOpen] = useState(false);
  const [flipped, setFlipped] = useState<Set<CreatureKey>>(new Set());

  // Only show when game is active (gator triggered this session or prior) and collection isn't empty
  if (!enabled || !hasCollectedCreature("gator") || collection.length === 0) return null;

  function toggleFlip(key: CreatureKey) {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <>
      {/* Floating golden bird cage button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 rounded-full bg-sidebar p-2.5 shadow-lg hover:shadow-xl transition-shadow"
        title="Menagerie"
      >
        <BirdCageIcon />
      </button>

      {/* Trophy case popup */}
      {open && (
        <div className="fixed bottom-16 right-5 z-50 w-72 rounded-xl bg-surface border border-border shadow-lg" data-menagerie-panel>
          {/* Header */}
          <div className="flex items-center justify-between bg-sidebar px-4 py-3 rounded-t-xl">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">
                Menagerie
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                {discoveredCount} of {CREATURES.length} found
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/50 hover:text-white rounded p-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* All 4 slots — discovered show creature, undiscovered show hint */}
          <div className="grid grid-cols-2 gap-3 p-4">
            {CREATURES.map((creature) => {
              const found = isDiscovered(creature.key);
              const discovery = collection.find(
                (d) => d.creature_key === creature.key
              );
              const SvgComponent = CREATURE_SVG[creature.key];
              const isFlipped = flipped.has(creature.key);

              // Undiscovered — hint only, no outline, no silhouette
              if (!found) {
                return (
                  <div
                    key={creature.key}
                    className="flex flex-col items-center justify-center rounded-lg p-3 text-center"
                    style={{ height: "120px" }}
                  >
                    <p className="text-lg text-text-tertiary/40 mb-2">?</p>
                    <p className="text-[11px] text-text-tertiary/90 italic leading-snug">
                      {creature.triggerHint}
                    </p>
                  </div>
                );
              }

              // Discovered — tappable card (front/back swap)
              return (
                <div
                  key={creature.key}
                  className="cursor-pointer rounded-lg border border-primary/30 overflow-hidden text-center transition-all duration-300"
                  style={{ height: "120px" }}
                  onClick={() => toggleFlip(creature.key)}
                >
                  {!isFlipped ? (
                    /* Front — creature + name */
                    <div className="flex flex-col items-center justify-center h-full bg-primary-light/30 p-2">
                      <div className="flex justify-center mb-1.5">
                        {creature.key === "peacock" ? (
                          <div className="peacock-card-dance">
                            <PeacockSvg
                              className="h-9 w-11"
                              tailClassName="peacock-tail-sway"
                            />
                          </div>
                        ) : (
                          <SvgComponent className="h-9 w-11" />
                        )}
                      </div>
                      <p className="text-xs font-medium text-text-primary leading-tight">
                        {creature.name}
                      </p>
                      {discovery && (
                        <p className="text-[11px] text-text-tertiary mt-0.5">
                          {format(parseISO(discovery.discovered_at), "MMM d")}
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Back — creature info */
                    <div className="flex flex-col items-center justify-center h-full bg-sidebar p-2.5 overflow-hidden">
                      <p className="text-xs font-semibold text-primary mb-1 leading-tight">
                        {creature.name}
                      </p>
                      <p className="text-[11px] text-white/70 leading-snug line-clamp-3">
                        {creature.description}
                      </p>
                      {discovery && (
                        <p className="text-[10px] text-white/40 mt-1.5">
                          {format(parseISO(discovery.discovered_at), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
            <button
              onClick={() => { releaseCreatures(); setOpen(false); }}
              className="text-[11px] text-black hover:text-black/80 transition-colors italic"
            >
              Release the critters
            </button>
            <button
              onClick={() => { requestZookeeper(); setOpen(false); }}
              className="text-[11px] text-black hover:text-black/80 transition-colors italic"
            >
              Call the Zookeeper
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function BirdCageIcon() {
  return (
    <Image
      src="/menagerie/victorian-cage-gold.png"
      alt="Menagerie"
      width={44}
      height={50}
      className="h-10 w-10 object-contain"
      priority
    />
  );
}
