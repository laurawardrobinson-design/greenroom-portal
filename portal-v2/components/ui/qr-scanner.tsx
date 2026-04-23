"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";

interface QrScannerProps {
  active: boolean;
  onScan: (code: string) => void;
  onError?: (error: string) => void;
}

export function QrScanner({ active, onScan, onError }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const lastScannedRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // State 2 = SCANNING
        if (state === 2) {
          await scannerRef.current.stop();
        }
      } catch {
        // Ignore stop errors
      }
      try {
        scannerRef.current.clear();
      } catch {
        // Ignore clear errors
      }
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      stopScanner();
      return;
    }

    let cancelled = false;

    async function startScanner() {
      if (!containerRef.current) return;
      setStarting(true);
      setPermissionDenied(false);
      setStartError(null);

      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        if (cancelled) return;

        // Ensure container has an ID for html5-qrcode
        const containerId = "qr-scanner-region";
        containerRef.current!.id = containerId;

        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        const scannerConfig = {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
        };
        const onScanSuccess = (decodedText: string) => {
          const normalized = decodedText.trim();
          if (!normalized) return;

          // Debounce: don't fire same code within 2 seconds
          const now = Date.now();
          if (
            normalized === lastScannedRef.current &&
            now - lastScannedTimeRef.current < 2000
          ) {
            return;
          }
          lastScannedRef.current = normalized;
          lastScannedTimeRef.current = now;
          onScan(normalized);
        };

        const onScanFailure = () => {
          // QR scan failure (no code detected) — ignore silently
        };

        try {
          // Prefer rear camera when available (mobile).
          await scanner.start(
            { facingMode: { exact: "environment" } },
            scannerConfig,
            onScanSuccess,
            onScanFailure
          );
        } catch {
          // Fallback for desktops or browsers that do not expose facingMode.
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras.length) {
            throw new Error("No camera devices available");
          }
          await scanner.start(cameras[0].id, scannerConfig, onScanSuccess, onScanFailure);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes("NotAllowedError") ||
          msg.includes("Permission") ||
          msg.includes("denied")
        ) {
          setPermissionDenied(true);
        } else {
          setStartError(msg);
          onError?.(msg);
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [active, onScan, onError, stopScanner]);

  if (!active) return null;

  if (permissionDenied) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-secondary p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-warning" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">
            Camera access required
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Allow camera access in your browser settings to scan QR codes, or
            use manual entry below.
          </p>
        </div>
      </div>
    );
  }

  if (startError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-secondary p-4 text-center">
        <p className="text-sm font-medium text-text-primary">Unable to start camera</p>
        <p className="text-xs text-text-secondary">
          {startError}
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      {/* Scanner container */}
      <div
        ref={containerRef}
        className="relative aspect-square w-full max-w-sm mx-auto [&>video]:!rounded-xl [&_#qr-shaded-region]:!border-0"
      />

      {/* Loading overlay */}
      {starting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <p className="text-sm text-white/80">Opening camera...</p>
        </div>
      )}

      {/* Scan region overlay corners */}
      {!starting && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-[220px] w-[220px]">
            {/* Top-left */}
            <div className="absolute -top-0.5 -left-0.5 h-6 w-6 border-t-[3px] border-l-[3px] border-primary rounded-tl-md" />
            {/* Top-right */}
            <div className="absolute -top-0.5 -right-0.5 h-6 w-6 border-t-[3px] border-r-[3px] border-primary rounded-tr-md" />
            {/* Bottom-left */}
            <div className="absolute -bottom-0.5 -left-0.5 h-6 w-6 border-b-[3px] border-l-[3px] border-primary rounded-bl-md" />
            {/* Bottom-right */}
            <div className="absolute -bottom-0.5 -right-0.5 h-6 w-6 border-b-[3px] border-r-[3px] border-primary rounded-br-md" />
          </div>
        </div>
      )}
    </div>
  );
}
