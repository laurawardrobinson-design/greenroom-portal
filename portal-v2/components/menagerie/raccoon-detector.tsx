"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RACCOON_TRIGGER_WORDS } from "@/lib/constants/menagerie";
import { CreatureAppearance, type TriggerPosition } from "./creature-appearance";
import { useMenagerieContext } from "./menagerie-provider";

const triggerPattern = new RegExp(
  `\\b(${RACCOON_TRIGGER_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i"
);

export function RaccoonDetector() {
  const { enabled, hasCollectedCreature, isDiscovered, releaseKey } = useMenagerieContext();
  const gatorFound = hasCollectedCreature("gator");
  const alreadyFound = isDiscovered("raccoon");
  const [triggered, setTriggered] = useState(false);
  const [position, setPosition] = useState<TriggerPosition>({ x: 0, y: 0 });
  const firedRef = useRef(false);
  const lastReleaseRef = useRef(0);

  // Reset when game restarts
  useEffect(() => {
    if (!alreadyFound) firedRef.current = false;
  }, [alreadyFound]);

  // Reset when creatures are released to roam again
  useEffect(() => {
    if (releaseKey > lastReleaseRef.current) {
      lastReleaseRef.current = releaseKey;
      firedRef.current = false;
    }
  }, [releaseKey]);

  const trigger = useCallback((pos: TriggerPosition) => {
    setPosition(pos);
    setTriggered(true);
  }, []);

  // Hover — event delegation, no DOM mutation
  useEffect(() => {
    if (!enabled || !gatorFound || firedRef.current) return;
    if (alreadyFound) return;

    function handleMouseOver(e: MouseEvent) {
      if (firedRef.current) return;
      const el = e.target as HTMLElement;
      if (!el || !el.textContent) return;
      if (el.closest("[data-menagerie-panel]")) return;
      if (el.children.length > 3) return;
      const text = el.textContent;
      if (text.length > 200) return;
      if (triggerPattern.test(text)) {
        firedRef.current = true;
        const rect = el.getBoundingClientRect();
        trigger({ x: rect.right, y: rect.top + rect.height / 2 });
      }
    }

    document.addEventListener("mouseover", handleMouseOver, { passive: true });
    return () => document.removeEventListener("mouseover", handleMouseOver);
  }, [trigger, enabled, gatorFound, alreadyFound, releaseKey]);

  if (!triggered) return null;

  return (
    <CreatureAppearance
      creature="raccoon"
      position={position}
      onDone={() => setTriggered(false)}
    />
  );
}
