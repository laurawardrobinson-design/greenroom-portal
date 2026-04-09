"use client";

import React from "react";
import type { StudioSpace, SpaceReservation } from "@/types/domain";

// ── SVG canvas ────────────────────────────────────────────────────────────────
const VW = 875;
const VH = 790;

// ── Fill palettes (SVG needs raw hex, not Tailwind classes) ───────────────────

// Per-shoot color palette — soft editorial tones in the app's family
// Index assigned to each campaign in order of first appearance
const SHOOT_COLORS: Array<{ fill: string; stroke: string; text: string }> = [
  { fill: "#DCFCE7", stroke: "#16A34A", text: "#14532D" }, // sage green  (brand-adjacent)
  { fill: "#E0F2FE", stroke: "#0284C7", text: "#0C4A6E" }, // sky blue
  { fill: "#EDE9FE", stroke: "#7C3AED", text: "#4C1D95" }, // soft violet
  { fill: "#FFE4E6", stroke: "#E11D48", text: "#9F1239" }, // dusty rose
  { fill: "#FEF3C7", stroke: "#D97706", text: "#78350F" }, // warm amber
];

// ── Room layout ───────────────────────────────────────────────────────────────
// Row heights: bays=220, multipurpose row=250, lower=200, conference=120
// Col width: 175 each × 5 = 875

interface FloorRoom {
  dbName: string | null;   // exact DB space name — null = non-reservable
  label: string;
  sub?: string;            // second line of label
  x: number;
  y: number;
  w: number;
  h: number;
  type?: string;
  dashTop?: boolean;       // dashed partition line at top edge
}

const ROOMS: FloorRoom[] = [
  // ── Top row: 5 equal bays ──────────────────────────────────────────────────
  { dbName: "Bay 1",               label: "BAY 1",                       x:   0, y:   0, w: 175, h: 220, type: "shooting_bay" },
  { dbName: "Bay 2",               label: "BAY 2",                       x: 175, y:   0, w: 175, h: 220, type: "shooting_bay" },
  { dbName: "Bay 3",               label: "BAY 3",                       x: 350, y:   0, w: 175, h: 220, type: "shooting_bay" },
  { dbName: "Bay 4",               label: "BAY 4",                       x: 525, y:   0, w: 175, h: 220, type: "shooting_bay" },
  { dbName: "Wardrobe / Dressing", label: "WARDROBE /", sub: "DRESSING", x: 700, y:   0, w: 175, h: 220, type: "wardrobe" },

  // ── Middle row ─────────────────────────────────────────────────────────────
  { dbName: null,                  label: "ENTRY",                       x:   0, y: 220, w: 175, h: 250 },
  { dbName: "Multipurpose Area",   label: "MULTIPURPOSE",                x: 175, y: 220, w: 525, h: 250, type: "multipurpose" },
  { dbName: "Prep Kitchen – Bay A",label: "PREP KITCHEN", sub: "BAY A",  x: 700, y: 220, w: 175, h: 125, type: "prep_kitchen" },
  { dbName: "Prep Kitchen – Bay B",label: "PREP KITCHEN", sub: "BAY B",  x: 700, y: 345, w: 175, h: 125, type: "prep_kitchen", dashTop: true },

  // ── Bottom row ─────────────────────────────────────────────────────────────
  { dbName: null,                  label: "COMMUNAL", sub: "WORKSPACE",  x:   0, y: 470, w: 175, h: 200 },
  { dbName: "Prop Storage",        label: "PROP", sub: "STORAGE",        x: 175, y: 470, w: 175, h: 200, type: "prop_storage" },
  { dbName: "Bay 5 / Set Kitchen", label: "BAY 5 /", sub: "SET KITCHEN", x: 350, y: 470, w: 350, h: 200, type: "set_kitchen" },
  { dbName: "Equipment Storage",   label: "EQUIPMENT", sub: "STORAGE",   x: 700, y: 470, w: 175, h: 200, type: "equipment_storage" },

  // ── Conference extension (hangs below bottom-left) ─────────────────────────
  { dbName: "Conference Room",     label: "CONFERENCE", sub: "ROOM",     x:   0, y: 670, w: 175, h: 120, type: "conference" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export interface FloorPlanProps {
  spaces: StudioSpace[];
  reservations: SpaceReservation[];
  onRoomClick: (space: StudioSpace, reservation: SpaceReservation | null) => void;
  /** spaceIds staged for reservation (pending confirmation) */
  selectedSpaceIds?: Set<string>;
  /** campaign being planned — rooms belonging to a different campaign are blocked */
  activeCampaignId?: string | null;
}

export function FloorPlan({ spaces, reservations, onRoomClick, selectedSpaceIds, activeCampaignId }: FloorPlanProps) {
  const spaceByName = React.useMemo(() => {
    const m = new Map<string, StudioSpace>();
    spaces.forEach((s) => m.set(s.name, s));
    return m;
  }, [spaces]);

  const resBySpaceId = React.useMemo(() => {
    const m = new Map<string, SpaceReservation>();
    reservations.forEach((r) => m.set(r.spaceId, r));
    return m;
  }, [reservations]);

  // Assign a stable color index to each campaign in order of first appearance
  const campaignColorIndex = React.useMemo(() => {
    const m = new Map<string, number>();
    reservations.forEach((r) => {
      if (r.campaignId && !m.has(r.campaignId)) {
        m.set(r.campaignId, m.size % SHOOT_COLORS.length);
      }
    });
    return m;
  }, [reservations]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full h-auto"
        aria-label="Greenroom floor plan"
      >
        <style>{`
          .floor-room { cursor: default; }
          .floor-room.interactive { cursor: pointer; }
          .floor-room.blocked { cursor: not-allowed; }
          .floor-room.interactive .room-fill { transition: filter 0.12s; }
          .floor-room.interactive:hover .room-fill { filter: brightness(0.93); }
        `}</style>

        {ROOMS.map((room) => {
          const space = room.dbName ? (spaceByName.get(room.dbName) ?? null) : null;
          const res   = space ? (resBySpaceId.get(space.id) ?? null) : null;
          const reservable = !!space;
          const booked     = !!res;

          // Selection / blocking states
          const isSelected    = selectedSpaceIds?.has(space?.id ?? "") ?? false;
          const isOurs        = booked && !!activeCampaignId && res?.campaignId === activeCampaignId;
          const isBlocked     = booked && !!activeCampaignId && res?.campaignId !== activeCampaignId;
          const isInteractive = reservable && !isBlocked;

          const shootColor = booked && res?.campaignId
            ? (SHOOT_COLORS[campaignColorIndex.get(res.campaignId) ?? 0])
            : null;

          const fill = !reservable
            ? "#FFFFFF"                                    // non-reservable: white
            : isSelected
            ? "#DBEAFE"                                    // staged: blue-100
            : booked
            ? (shootColor?.fill ?? "#E2E8F0")             // reserved: shoot color
            : "#F8FAFC";                                   // available: light gray

          const stroke      = isSelected ? "#2563EB" : booked ? (shootColor?.stroke ?? "#1E293B") : "#1E293B";
          const strokeWidth = isSelected ? "3"       : booked ? "2.5" : "2";

          const labelColor = !reservable
            ? "#94A3B8"
            : isSelected
            ? "#1D4ED8"                                    // blue-700
            : booked
            ? (shootColor?.text ?? "#334155")
            : "#475569";

          const cx = room.x + room.w / 2;
          const cy = room.y + room.h / 2;

          // Uniform font size across all rooms — SVG scales to ~80% of viewBox so 16 renders ~13px
          const fs  = 16;
          const fsS = 13;

          // Vertical block layout
          const lineH      = fs + 6;
          const labelLines = room.sub ? 2 : 1;
          const resLines   = booked ? 1 : 0;
          const totalH     = (labelLines + resLines - 1) * lineH + (booked ? 8 : 0);
          let   textY      = cy - totalH / 2;

          return (
            <g
              key={`${room.dbName ?? room.label}-${room.x}`}
              className={`floor-room${isInteractive ? " interactive" : ""}${isBlocked ? " blocked" : ""}`}
              onClick={isInteractive ? () => onRoomClick(space!, res) : undefined}
              role={isInteractive ? "button" : undefined}
            >
              {/* Room fill */}
              <rect
                className="room-fill"
                x={room.x} y={room.y}
                width={room.w} height={room.h}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
              />

              {/* Dashed moveable partition (Prep B) */}
              {room.dashTop && (
                <line
                  x1={room.x + 2}          y1={room.y}
                  x2={room.x + room.w - 2} y2={room.y}
                  stroke="#94A3B8"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
              )}

              {/* Label line 1 */}
              <text
                x={cx} y={textY}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={fs}
                fontWeight="700"
                fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
                letterSpacing="0.05em"
                fill={labelColor}
                style={{ userSelect: "none" }}
              >
                {room.label}
              </text>

              {/* Label line 2 (sub) */}
              {room.sub && (() => {
                textY += lineH;
                return (
                  <text
                    key="sub"
                    x={cx} y={textY}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={fs}
                    fontWeight="600"
                    fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
                    letterSpacing="0.04em"
                    fill={labelColor}
                    style={{ userSelect: "none" }}
                  >
                    {room.sub}
                  </text>
                );
              })()}

              {/* Reservation info */}
              {booked && res && (() => {
                textY += lineH + 8;
                const nameY = textY + 4;
                const maxCh = Math.floor(room.w / (fsS * 0.58));
                const name  = res.campaign?.name ?? "";
                const nameStr = name.length > maxCh ? name.slice(0, maxCh - 1) + "…" : name;
                return (
                  <>
                    <text
                      x={cx} y={nameY}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={fsS}
                      fontFamily="ui-sans-serif, system-ui, sans-serif"
                      fill={labelColor}
                      style={{ userSelect: "none" }}
                    >
                      {nameStr}
                    </text>
                  </>
                );
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
