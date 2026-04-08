"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { Search, Plus, X, Check, Package } from "lucide-react";
import type { GearItem } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error(); return r.json(); });

interface Props {
  /** "props" or "surface" — controls which section of the gear library is searched */
  mode: "props" | "surface";
  /** Current text value (comma-separated names + any free text) */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ShotPropsPicker({ mode, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Build query: for surface mode only show Surfaces & Backgrounds category; for props show all Props
  const categoryParam = mode === "surface" ? "&category=Surfaces+%26+Backgrounds" : "";
  const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
  const { data: items = [] } = useSWR<GearItem[]>(
    open ? `/api/gear?section=Props${categoryParam}${searchParam}` : null,
    fetcher
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Parse current selections from the comma-separated value
  const selected = new Set(
    value.split(",").map((s) => s.trim()).filter(Boolean)
  );

  function toggleItem(name: string) {
    const next = new Set(selected);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    onChange(Array.from(next).join(", "));
  }

  function removeItem(name: string) {
    const next = new Set(selected);
    next.delete(name);
    onChange(Array.from(next).join(", "));
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected tags + free text input row */}
      <div className="flex flex-wrap items-center gap-1 min-h-[28px]">
        {Array.from(selected).map((name) => (
          <span key={name} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {name}
            <button
              type="button"
              onClick={() => removeItem(name)}
              className="text-primary/60 hover:text-primary transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-0.5 text-[11px] text-text-tertiary hover:text-primary transition-colors"
        >
          <Plus className="h-3 w-3" />
          {selected.size === 0 ? (placeholder ?? "Browse library…") : "Add more"}
        </button>
      </div>

      {/* Dropdown picker */}
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={mode === "surface" ? "Search surfaces…" : "Search props…"}
              className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-text-tertiary hover:text-text-primary">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {items.length === 0 ? (
              <p className="px-3 py-2 text-xs text-text-tertiary">
                {search ? "No matches" : mode === "surface" ? "No surfaces in library" : "No props in library"}
              </p>
            ) : (
              items.map((item) => {
                const isSelected = selected.has(item.name);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleItem(item.name)}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-surface-secondary transition-colors"
                  >
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                      {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">{item.name}</p>
                      {item.category && (
                        <p className="text-[10px] text-text-tertiary">{item.category}</p>
                      )}
                    </div>
                    <Package className="h-3 w-3 text-text-tertiary/40 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
