"use client";

import React from "react";
import type { StudioSpace, SpaceReservation } from "@/types/domain";

// ── SVG canvas ────────────────────────────────────────────────────────────────
const VW = 875;
const VH = 790;

// ── Fill palettes (SVG needs raw hex, not Tailwind classes) ───────────────────

// Light tint — available state
const AVAIL: Record<string, string> = {
  shooting_bay:      "#EFF6FF", // blue-50
  set_kitchen:       "#FFF7ED", // orange-50
  prep_kitchen:      "#FFFBEB", // amber-50
  wardrobe:          "#FAF5FF", // purple-50
  multipurpose:      "#F0FDF4", // green-50
  conference:        "#EEF2FF", // indigo-50
  equipment_storage: "#F8FAFC", // slate-50
  prop_storage:      "#FAFAFA", // zinc-50
};

// Medium tint — reserved state
const RESERVED: Record<string, string> = {
  shooting_bay:      "#BFDBFE", // blue-200
  set_kitchen:       "#FED7AA", // orange-200
  prep_kitchen:      "#FDE68A", // amber-200
  wardrobe:          "#E9D5FF", // purple-200
  multipurpose:      "#BBF7D0", // green-200
  conference:        "#C7D2FE", // indigo-200
  equipment_storage: "#CBD5E1", // slate-300
  prop_storage:      "#D4D4D8", // zinc-300
};

// Text color when reserved (darker shade of same hue)
const RES_TEXT: Record<string, string> = {
  shooting_bay:      "#1D4ED8", // blue-700
  set_kitchen:       "#C2410C", // orange-700
  prep_kitchen:      "#B45309", // amber-700
  wardrobe:          "#7E22CE", // purple-700
  multipurpose:      "#15803D", // green-700
  conference:        "#4338CA", // indigo-700
  equipment_storage: "#334155", // slate-700
  prop_storage:      "#3F3F46", // zinc-700
};

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
}

export function FloorPlan({ spaces, reservations, onRoomClick }: FloorPlanProps) {
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

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full h-auto"
        style={{ minWidth: 540 }}
        aria-label="Greenroom floor plan"
      >
        <style>{`
          .floor-room { cursor: default; }
          .floor-room.reservable { cursor: pointer; }
          .floor-room.reservable .room-fill { transition: filter 0.12s; }
          .floor-room.reservable:hover .room-fill { filter: brightness(0.94); }
        `}</style>

        {ROOMS.map((room) => {
          const space = room.dbName ? (spaceByName.get(room.dbName) ?? null) : null;
          const res   = space ? (resBySpaceId.get(space.id) ?? null) : null;
          const reservable = !!space;
          const booked     = !!res;

          const fill = !reservable
            ? "#F1F5F9"
            : booked
            ? (RESERVED[room.type!] ?? "#E2E8F0")
            : (AVAIL[room.type!]    ?? "#F8FAFC");

          const labelColor = !reservable
            ? "#94A3B8"
            : booked
            ? (RES_TEXT[room.type!] ?? "#334155")
            : "#64748B";

          const cx = room.x + room.w / 2;
          const cy = room.y + room.h / 2;

          // Font size: smaller for narrow rooms, larger for wide
          const fs  = room.w < 200 ? 11 : room.w > 400 ? 14 : 12;
          const fsS = room.w < 200 ? 10 : 11;

          // Vertical block layout
          const lineH      = fs + 6;
          const labelLines = room.sub ? 2 : 1;
          const resLines   = booked ? 2 : 0;
          const totalH     = (labelLines + resLines - 1) * lineH + (booked ? 8 : 0);
          let   textY      = cy - totalH / 2;

          return (
            <g
              key={`${room.dbName ?? room.label}-${room.x}`}
              className={`floor-room${reservable ? " reservable" : ""}`}
              onClick={reservable ? () => onRoomClick(space!, res) : undefined}
              role={reservable ? "button" : undefined}
            >
              {/* Room fill */}
              <rect
                className="room-fill"
                x={room.x} y={room.y}
                width={room.w} height={room.h}
                fill={fill}
                stroke="#1E293B"
                strokeWidth="2"
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
                fontWeight="600"
                fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
                letterSpacing="0.04em"
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
                const divY  = textY - 4;
                const wfY   = textY + 4;
                const nameY = wfY + lineH;
                const maxCh = Math.floor(room.w / (fsS * 0.58));
                const name  = res.campaign?.name ?? "";
                const nameStr = name.length > maxCh ? name.slice(0, maxCh - 1) + "…" : name;
                return (
                  <>
                    <line
                      x1={cx - Math.min(24, room.w * 0.15)} y1={divY}
                      x2={cx + Math.min(24, room.w * 0.15)} y2={divY}
                      stroke={labelColor} strokeWidth="1" opacity="0.3"
                    />
                    <text
                      x={cx} y={wfY}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={fs}
                      fontWeight="700"
                      fontFamily="ui-monospace, 'SF Mono', Menlo, monospace"
                      fill={labelColor}
                      style={{ userSelect: "none" }}
                    >
                      {res.campaign?.wfNumber ?? "—"}
                    </text>
                    <text
                      x={cx} y={nameY}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={fsS}
                      fontFamily="ui-sans-serif, system-ui, sans-serif"
                      fill={labelColor}
                      opacity="0.75"
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
