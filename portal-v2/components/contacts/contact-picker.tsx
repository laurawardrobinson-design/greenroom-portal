"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { User, Building2 } from "lucide-react";
import type { ContactPickerResult } from "@/types/domain";

// Contact picker — searches users + vendors via /api/contacts.
// Lets the caller accept a selection (name + phone).
export function ContactPicker({
  value,
  placeholder = "Search contacts…",
  onSelect,
  onFreeText,
  disabled = false,
}: {
  value: string;
  placeholder?: string;
  onSelect: (contact: ContactPickerResult) => void;
  onFreeText?: (name: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<ContactPickerResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/contacts?search=${encodeURIComponent(q)}`,
        { signal: ac.signal }
      );
      if (!res.ok) return;
      const data = (await res.json()) as ContactPickerResult[];
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      /* ignore aborts */
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          runSearch(e.target.value);
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
          if (onFreeText && query !== value) onFreeText(query);
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        className="w-full rounded-md border border-border bg-surface-secondary/20 px-2 py-1.5 text-sm focus:border-primary focus:outline-none disabled:bg-surface-secondary disabled:text-text-tertiary"
      />
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-72 rounded-lg border border-border bg-surface shadow-lg overflow-hidden">
          {loading && results.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-text-tertiary">Searching…</div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.source}:${r.id}`}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-secondary transition-colors border-b border-border/50 last:border-b-0"
                onMouseDown={() => {
                  onSelect(r);
                  setQuery(r.name);
                  setOpen(false);
                }}
              >
                {r.source === "user" ? (
                  <User className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                ) : (
                  <Building2 className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-text-primary truncate">{r.name}</div>
                  {(r.subtitle || r.phone) && (
                    <div className="text-[11px] text-text-tertiary truncate">
                      {[r.subtitle, r.phone].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
