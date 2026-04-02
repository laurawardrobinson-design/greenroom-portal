"use client";

import { useState, useEffect, useRef } from "react";
import { GatorSvg, ZookeeperSvg } from "@/components/menagerie/creatures";
import { useMenagerieContext } from "@/components/menagerie/menagerie-provider";

export function GatorEasterEgg() {
  const [chomping, setChomping] = useState(false);
  const [showCritterLine, setShowCritterLine] = useState(false);
  const [zookeeperWalking, setZookeeperWalking] = useState(false);
  const {
    discoverCreature,
    activateMenagerie,
    enabled,
    hasCollectedCreature,
    isDiscovered,
    resetCollection,
    zookeeperRequest,
  } = useMenagerieContext();
  const gatorFound = hasCollectedCreature("gator");
  const gatorCurrentlyLoose = !isDiscovered("gator");
  const lastZookeeperRequest = useRef(0);
  const pendingZookeeperRequest = useRef(false);

  function triggerChomp() {
    if (chomping || zookeeperWalking) return;
    setChomping(true);
    activateMenagerie();
    if (gatorCurrentlyLoose) {
      discoverCreature("gator");
    }
    setTimeout(() => { setChomping(false); setShowCritterLine(false); }, 8000);
    setTimeout(() => setShowCritterLine(true), 5600);
  }

  function triggerZookeeper() {
    if (zookeeperWalking || chomping) return false;
    setZookeeperWalking(true);
    // Halfway through walk — text appears + menagerie disappears
    setTimeout(() => {
      void resetCollection().catch((error) => {
        console.error("Failed to reset menagerie", error);
      });
    }, 1750);
    setTimeout(() => setZookeeperWalking(false), 3700);
    return true;
  }

  // Respond to zookeeper requests from the menagerie panel
  useEffect(() => {
    if (zookeeperRequest > lastZookeeperRequest.current) {
      if (triggerZookeeper()) {
        lastZookeeperRequest.current = zookeeperRequest;
        pendingZookeeperRequest.current = false;
      } else {
        pendingZookeeperRequest.current = true;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zookeeperRequest, chomping, zookeeperWalking]);

  useEffect(() => {
    if (
      pendingZookeeperRequest.current &&
      !chomping &&
      !zookeeperWalking &&
      zookeeperRequest > lastZookeeperRequest.current
    ) {
      if (triggerZookeeper()) {
        lastZookeeperRequest.current = zookeeperRequest;
        pendingZookeeperRequest.current = false;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chomping, zookeeperWalking, zookeeperRequest]);

  return (
    <div className="relative mx-4 my-2">
      {/* The secret trigger box + animation container */}
      <div className="relative h-8 overflow-visible">
        {/* Zookeeper scene — walks left to right */}
        {zookeeperWalking && (
          <>
            <div className="zookeeper-walk absolute left-0 top-0 flex items-center" style={{ left: "-40px" }}>
              <div className="zookeeper-stride">
                <ZookeeperSvg className="h-8 w-6" />
              </div>
            </div>
            <div className="zookeeper-text absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-medium text-primary/70 tracking-wider text-center leading-tight">
                Zookeeper caught all
                <br />
                the critters!
              </span>
            </div>
          </>
        )}

        {/* Gator credit text */}
        {chomping && !zookeeperWalking && (
          <div className="absolute inset-0 flex items-center justify-center">
            {!showCritterLine && (
              <span className="gator-credit text-[11px] font-medium text-primary/70 tracking-wider text-center leading-tight">
                from the giant mutant brain
                <br />
                of Laura Robinson
              </span>
            )}
            {showCritterLine && (
              <span className="critter-line text-[11px] font-medium text-primary/70 tracking-wider text-center leading-tight">
                Critters got loose!
              </span>
            )}
          </div>
        )}

        {/* Gator — starts right, walks left */}
        {chomping && !zookeeperWalking ? (
          <div className="gator-walk absolute right-0 top-1 flex items-center">
            <div style={{ transform: "scaleX(-1)" }}>
              <GatorSvg className="h-7 w-10 gator-waddle" />
            </div>
          </div>
        ) : !zookeeperWalking ? (
          <div className="flex items-center h-full">
            {/* Zookeeper trigger — far left side, only visible after gator found + enabled */}
            {gatorFound && enabled && (
              <div
                onMouseEnter={triggerZookeeper}
                className="h-6 w-4 cursor-default shrink-0"
              />
            )}
            {/* Gator trigger — right side */}
            <div className="flex-1 flex items-center justify-end h-full">
              <div
                onMouseEnter={triggerChomp}
                className="h-6 w-6 cursor-default"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
