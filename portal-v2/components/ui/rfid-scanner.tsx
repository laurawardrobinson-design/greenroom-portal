"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Radio } from "lucide-react";

interface RfidScannerProps {
  active: boolean;
  onScan: (epc: string) => void;
  /** If provided, shown as a hint below the listener UI */
  hint?: string;
}

/**
 * Keyboard-wedge RFID scanner.
 *
 * Most UHF RFID USB readers operate in HID mode — they emulate a keyboard,
 * typing the EPC tag string (e.g. "E2001234567890ABCDEF1234") followed by
 * Enter, very rapidly (< 50ms for the full string).
 *
 * This component captures that by:
 *   1. Rendering a visually-hidden input that stays focused while active
 *   2. Buffering keystrokes with onKeyDown
 *   3. Firing onScan when Enter is received and the buffer has content
 *   4. Resetting the buffer if 300ms passes without a new keystroke
 *      (handles edge cases where Enter is somehow missed)
 *
 * Click anywhere on the component to re-focus the input if it loses focus.
 */
export function RfidScanner({ active, onScan, hint }: RfidScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef<string>("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focused, setFocused] = useState(false);
  const [flash, setFlash] = useState(false);

  // Auto-focus when activated
  useEffect(() => {
    if (active) {
      inputRef.current?.focus();
    } else {
      bufferRef.current = "";
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [active]);

  const fireAndReset = useCallback(
    (epc: string) => {
      const trimmed = epc.trim();
      if (!trimmed) return;
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
      onScan(trimmed);
      bufferRef.current = "";
    },
    [onScan]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!active) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (e.key === "Enter") {
      e.preventDefault();
      // Read directly from the input value as the source of truth
      const val = (inputRef.current?.value ?? bufferRef.current).trim();
      if (val) fireAndReset(val);
      if (inputRef.current) inputRef.current.value = "";
      bufferRef.current = "";
      return;
    }

    // Auto-flush after 300ms of inactivity
    timeoutRef.current = setTimeout(() => {
      const val = (inputRef.current?.value ?? bufferRef.current).trim();
      if (val.length >= 6) {
        fireAndReset(val);
        if (inputRef.current) inputRef.current.value = "";
      }
      bufferRef.current = "";
    }, 300);
  }

  if (!active) return null;

  return (
    <div
      className="relative cursor-pointer select-none"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Hidden capture input — uncontrolled so the browser accepts typed chars */}
      <input
        ref={inputRef}
        type="text"
        defaultValue=""
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (active) {
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        }}
        className="absolute -top-px -left-px h-px w-px opacity-0 pointer-events-none"
        aria-label="RFID reader input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {/* Visual indicator */}
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-4 transition-all duration-200 ${
          flash
            ? "border-emerald-400 bg-emerald-50"
            : focused
            ? "border-primary bg-primary/5"
            : "border-border bg-surface-secondary/60"
        }`}
      >
        {/* Pulsing radio icon */}
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          {focused && !flash && (
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          )}
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              flash
                ? "bg-emerald-100"
                : focused
                ? "bg-primary/10"
                : "bg-surface-tertiary"
            }`}
          >
            <Radio
              className={`h-5 w-5 ${
                flash
                  ? "text-success"
                  : focused
                  ? "text-primary"
                  : "text-text-tertiary"
              }`}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${
              flash
                ? "text-success"
                : focused
                ? "text-text-primary"
                : "text-text-secondary"
            }`}
          >
            {flash
              ? "Tag detected"
              : focused
              ? "Listening for RFID tags…"
              : "Click to start listening"}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5">
            {hint ??
              "Hold a tagged item near the reader — tags add to the cart automatically"}
          </p>
        </div>

        {/* Focus indicator dot */}
        <div
          className={`h-2 w-2 rounded-full shrink-0 transition-colors ${
            flash
              ? "bg-emerald-500"
              : focused
              ? "bg-primary animate-pulse"
              : "bg-surface-tertiary"
          }`}
        />
      </div>
    </div>
  );
}
