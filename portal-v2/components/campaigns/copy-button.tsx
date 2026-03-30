"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy full name"
      className="shrink-0 transition-colors"
    >
      {copied ? (
        <span className="text-[10px] font-medium text-emerald-500">Copied</span>
      ) : (
        <Copy className="h-3 w-3 text-text-tertiary hover:text-text-primary" />
      )}
    </button>
  );
}
