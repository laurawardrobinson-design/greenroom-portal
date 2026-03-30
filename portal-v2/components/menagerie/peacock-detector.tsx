"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PEACOCK_TRIGGER_WORDS } from "@/lib/constants/menagerie";
import { CreatureAppearance, type TriggerPosition } from "./creature-appearance";
import { useMenagerieContext } from "./menagerie-provider";

const triggerPattern = new RegExp(
  `\\b(${PEACOCK_TRIGGER_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i"
);

export function PeacockDetector() {
  const { enabled, hasCollectedCreature, isDiscovered, releaseKey } = useMenagerieContext();
  const gatorFound = hasCollectedCreature("gator");
  const alreadyFound = isDiscovered("peacock");
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

  // MODE 1: Typing — listen for input events via delegation
  useEffect(() => {
    if (!enabled || !gatorFound || firedRef.current) return;
    if (alreadyFound) return;

    function handleInput(e: Event) {
      if (firedRef.current) return;
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!target || !("value" in target)) return;
      if (triggerPattern.test(target.value)) {
        firedRef.current = true;
        const rect = target.getBoundingClientRect();
        trigger({ x: rect.left + rect.width / 2, y: rect.top });
      }
    }

    document.addEventListener("input", handleInput, { passive: true });
    return () => document.removeEventListener("input", handleInput);
  }, [trigger, enabled, gatorFound, alreadyFound, releaseKey]);

  // MODE 2: Hover — event delegation, no DOM mutation
  useEffect(() => {
    if (!enabled || !gatorFound || firedRef.current) return;
    if (alreadyFound) return;

    function handleMouseOver(e: MouseEvent) {
      if (firedRef.current) return;
      const el = e.target as HTMLElement;
      if (!el || !el.textContent) return;
      // Only check leaf-ish elements (not huge containers)
      if (el.children.length > 3) return;
      const text = el.textContent;
      if (text.length > 200) return;
      if (triggerPattern.test(text)) {
        firedRef.current = true;
        const rect = el.getBoundingClientRect();
        trigger({ x: rect.left + rect.width / 2, y: rect.top });
      }
    }

    document.addEventListener("mouseover", handleMouseOver, { passive: true });
    return () => document.removeEventListener("mouseover", handleMouseOver);
  }, [trigger, enabled, gatorFound, alreadyFound, releaseKey]);

  if (!triggered) return null;

  return (
    <CreatureAppearance
      creature="peacock"
      position={position}
      onDone={() => setTriggered(false)}
    />
  );
}
