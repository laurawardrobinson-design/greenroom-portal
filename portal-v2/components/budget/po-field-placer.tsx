"use client";

import { useEffect, useRef, useState } from "react";
import { PenLine, GripVertical, Info } from "lucide-react";

// The "reference height" for the PO document preview iframe.
// Percentages stored in DB are relative to this height so they
// translate correctly to the final rendered PO page.
export const PO_DOC_REF_HEIGHT = 900;
export const PO_DOC_REF_WIDTH = 680;

export interface FieldPositions {
  signatureFieldX: number;
  signatureFieldY: number;
  poNumberFieldX: number;
  poNumberFieldY: number;
}

interface Props {
  campaignVendorId: string;
  poNumber: string;
  initial: FieldPositions;
  onChange: (positions: FieldPositions) => void;
}

type DraggingField = "sig" | "po" | null;

export function PoFieldPlacer({ campaignVendorId, poNumber, initial, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [positions, setPositions] = useState<FieldPositions>(initial);
  const [dragging, setDragging] = useState<DraggingField>(null);

  // Sync upward whenever positions change
  useEffect(() => {
    onChange(positions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  function startDrag(field: DraggingField) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(field);

      const container = containerRef.current;
      if (!container) return;

      function onMove(ev: MouseEvent) {
        const rect = container!.getBoundingClientRect();
        // Scroll offset: the container itself may be scrolled
        const scrollTop = container!.scrollTop;
        const rawX = ((ev.clientX - rect.left) / rect.width) * 100;
        const rawY = (((ev.clientY - rect.top) + scrollTop) / PO_DOC_REF_HEIGHT) * 100;

        const x = Math.max(0, Math.min(80, rawX));
        const y = Math.max(0, Math.min(92, rawY));

        setPositions((prev) => {
          const next = field === "sig"
            ? { ...prev, signatureFieldX: x, signatureFieldY: y }
            : { ...prev, poNumberFieldX: x, poNumberFieldY: y };
          return next;
        });
      }

      function onUp() {
        setDragging(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
  }

  const sigLeft = `${positions.signatureFieldX}%`;
  const sigTop  = `${(positions.signatureFieldY / 100) * PO_DOC_REF_HEIGHT}px`;
  const poLeft  = `${positions.poNumberFieldX}%`;
  const poTop   = `${(positions.poNumberFieldY / 100) * PO_DOC_REF_HEIGHT}px`;

  return (
    <div className="space-y-3">
      {/* Instruction strip */}
      <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
        <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary">
          Drag the <span className="font-semibold text-text-primary">Signature</span> and{" "}
          <span className="font-semibold text-text-primary">PO Number</span> fields to where they
          should appear on the document. The vendor will sign at the highlighted location.
        </p>
      </div>

      {/* Document + overlay container */}
      <div
        ref={containerRef}
        className="relative border border-border rounded-lg overflow-auto bg-white"
        style={{ height: "420px" }}
      >
        {/* The actual PO document (same-origin iframe) */}
        <iframe
          ref={iframeRef}
          src={`/po/${campaignVendorId}`}
          title="PO Document"
          className="border-0 block"
          style={{
            width: "100%",
            height: `${PO_DOC_REF_HEIGHT}px`,
            // During drag, disable pointer events so the mouse doesn't
            // get "captured" by the iframe and break the drag.
            pointerEvents: dragging ? "none" : "auto",
          }}
        />

        {/* Overlay — same physical size as the iframe */}
        <div
          className="absolute top-0 left-0 w-full"
          style={{
            height: `${PO_DOC_REF_HEIGHT}px`,
            // Only capture pointer events when actively dragging.
            pointerEvents: dragging ? "auto" : "none",
          }}
        />

        {/* ── Signature field ── */}
        <div
          onMouseDown={startDrag("sig")}
          className="absolute z-20 group select-none"
          style={{
            left: sigLeft,
            top: sigTop,
            cursor: dragging === "sig" ? "grabbing" : "grab",
            pointerEvents: "auto",
          }}
        >
          <div
            className={`flex items-center gap-1.5 rounded border-2 px-2.5 py-1.5 shadow-sm transition-colors ${
              dragging === "sig"
                ? "border-primary bg-primary text-white"
                : "border-primary bg-primary/10 text-primary hover:bg-primary/20"
            }`}
            style={{ whiteSpace: "nowrap" }}
          >
            <GripVertical className="h-3 w-3 opacity-60 shrink-0" />
            <PenLine className="h-3 w-3 shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wide">Vendor Signature</span>
          </div>
          {/* Drop shadow below to show it floats over doc */}
          <div className="h-0.5 w-full bg-primary/30 rounded-b" />
        </div>

        {/* ── PO Number field ── */}
        <div
          onMouseDown={startDrag("po")}
          className="absolute z-20 select-none"
          style={{
            left: poLeft,
            top: poTop,
            cursor: dragging === "po" ? "grabbing" : "grab",
            pointerEvents: "auto",
          }}
        >
          <div
            className={`flex items-center gap-2 border-2 border-dashed px-3 py-2 shadow-sm transition-colors bg-white ${
              dragging === "po" ? "border-gray-600" : "border-gray-400 hover:border-gray-600"
            }`}
            style={{ whiteSpace: "nowrap" }}
          >
            <GripVertical className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-sm font-mono font-semibold text-gray-900">{poNumber}</span>
          </div>
        </div>
      </div>

      {/* Field legend */}
      <div className="flex items-center gap-4 text-[11px] text-text-tertiary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-primary bg-primary/10" />
          Vendor signs here
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 border-2 border-dashed border-gray-400 bg-white" />
          PO number appears here
        </span>
      </div>
    </div>
  );
}
