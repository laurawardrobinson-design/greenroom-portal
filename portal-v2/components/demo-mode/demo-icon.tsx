"use client";

import { Zap } from "lucide-react";
import { useState } from "react";
import { DemoModeModal } from "./demo-mode-modal";

export function DemoIcon() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="View Demo Mode"
        className="inline-flex items-center justify-center rounded-lg p-2 text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
      >
        <Zap className="h-5 w-5" />
      </button>
      {isOpen && <DemoModeModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
