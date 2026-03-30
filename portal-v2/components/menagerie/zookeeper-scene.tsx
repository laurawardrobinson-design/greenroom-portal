"use client";

import { useEffect, useEffectEvent } from "react";
import { ZookeeperSvg } from "./creatures";
import { useMenagerieContext } from "./menagerie-provider";

interface ZookeeperSceneProps {
  onDone: () => void;
}

export function ZookeeperScene({ onDone }: ZookeeperSceneProps) {
  const { setEnabled } = useMenagerieContext();
  const handleDone = useEffectEvent(onDone);

  useEffect(() => {
    const timer = setTimeout(() => {
      setEnabled(false);
      handleDone();
    }, 4200); // slightly after the 4s walk animation ends
    return () => clearTimeout(timer);
  }, [setEnabled]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {/* Zookeeper walks left to right */}
      <div className="zookeeper-walk absolute bottom-16" style={{ left: "-60px" }}>
        <div className="zookeeper-stride">
          <ZookeeperSvg className="h-12 w-10" />
        </div>
      </div>

      {/* Text appears halfway through */}
      <div className="zookeeper-text absolute inset-0 flex items-end justify-center pb-24">
        <span className="text-[9px] font-medium text-text-secondary tracking-wider text-center">
          All creatures caught and rehomed
        </span>
      </div>
    </div>
  );
}
