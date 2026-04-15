"use client";

import React from "react";
import type { EditRoom, EditRoomReservation } from "@/types/domain";

// ── SVG canvas ────────────────────────────────────────────────────────────────
const ROOM_W = 292;
const ROOM_H = 215;
const COLS = 3;
const ROWS = 2;
const VW = ROOM_W * COLS; // 876
const VH = ROOM_H * ROWS; // 430

// ── Per-room color palette (SVG needs raw hex, not Tailwind classes) ──────────
// Matches EDIT_ROOM_COLORS order: violet, sky, emerald, amber, rose, teal
const ROOM_COLORS: Array<{ fill: string; stroke: string; text: string }> = [
  { fill: "#EDE9FE", stroke: "#7C3AED", text: "#4C1D95" }, // violet
  { fill: "#E0F2FE", stroke: "#0284C7", text: "#0C4A6E" }, // sky
  { fill: "#D1FAE5", stroke: "#059669", text: "#064E3B" }, // emerald
  { fill: "#FEF3C7", stroke: "#D97706", text: "#78350F" }, // amber
  { fill: "#FFE4E6", stroke: "#E11D48", text: "#9F1239" }, // rose
  { fill: "#CCFBF1", stroke: "#0D9488", text: "#134E4A" }, // teal
];

// ── Component ─────────────────────────────────────────────────────────────────

export interface EditRoomMapProps {
  rooms: EditRoom[];
  /** roomId → reservation for the currently selected date */
  reservationsByRoom: Map<string, EditRoomReservation>;
  onRoomClick: (room: EditRoom, reservation: EditRoomReservation | null) => void;
  canWrite: boolean;
}

export function EditRoomMap({
  rooms,
  reservationsByRoom,
  onRoomClick,
  canWrite,
}: EditRoomMapProps) {
  const visibleRooms = rooms.slice(0, COLS * ROWS);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full h-auto"
        aria-label="Edit rooms floor map"
      >
        <style>{`
          .edit-room { cursor: default; }
          .edit-room.interactive { cursor: pointer; }
          .edit-room.interactive .room-fill { transition: filter 0.12s; }
          .edit-room.interactive:hover .room-fill { filter: brightness(0.93); }
        `}</style>

        {visibleRooms.map((room, idx) => {
          const col = idx % COLS;
          const row = Math.floor(idx / COLS);
          const x = col * ROOM_W;
          const y = row * ROOM_H;

          const reservation = reservationsByRoom.get(room.id) ?? null;
          const booked = !!reservation;
          const color = ROOM_COLORS[idx % ROOM_COLORS.length];

          const fill = booked ? color.fill : "#F8FAFC";
          const stroke = booked ? color.stroke : "#1E293B";
          const strokeWidth = booked ? "2.5" : "2";
          const labelColor = booked ? color.text : "#475569";

          const isInteractive = canWrite || booked;

          const cx = x + ROOM_W / 2;
          const cy = y + ROOM_H / 2;

          const fs = 16;
          const fsS = 13;
          const lineH = fs + 6;

          // Room name — split on " / " or show as one line, uppercased
          const [nameLine1, nameLine2] = room.name.includes(" / ")
            ? room.name.split(" / ").map((s) => s.toUpperCase())
            : [room.name.toUpperCase(), undefined];

          const nameLines = nameLine2 ? 2 : 1;
          const resLines = booked ? (reservation.campaignWfNumber ? 2 : 1) : 0;
          const totalLines = nameLines + resLines;
          const totalH = (totalLines - 1) * lineH + (booked ? 10 : 0);
          let textY = cy - totalH / 2;

          return (
            <g
              key={room.id}
              className={`edit-room${isInteractive ? " interactive" : ""}`}
              onClick={isInteractive ? () => onRoomClick(room, reservation) : undefined}
              role={isInteractive ? "button" : undefined}
            >
              {/* Room fill */}
              <rect
                className="room-fill"
                x={x}
                y={y}
                width={ROOM_W}
                height={ROOM_H}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
              />

              {/* Room name line 1 */}
              <text
                x={cx}
                y={textY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fs}
                fontWeight="700"
                fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
                letterSpacing="0.05em"
                fill={labelColor}
                style={{ userSelect: "none" }}
              >
                {nameLine1}
              </text>

              {/* Room name line 2 (if split) */}
              {nameLine2 &&
                (() => {
                  textY += lineH;
                  return (
                    <text
                      key="name2"
                      x={cx}
                      y={textY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fs}
                      fontWeight="700"
                      fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
                      letterSpacing="0.05em"
                      fill={labelColor}
                      style={{ userSelect: "none" }}
                    >
                      {nameLine2}
                    </text>
                  );
                })()}

              {/* Reservation info */}
              {booked &&
                reservation &&
                (() => {
                  textY += lineH + 10;
                  const maxCh = Math.floor(ROOM_W / (fsS * 0.58));
                  const editorStr =
                    reservation.editorName.length > maxCh
                      ? reservation.editorName.slice(0, maxCh - 1) + "…"
                      : reservation.editorName;
                  const wfStr = reservation.campaignWfNumber ?? null;

                  return (
                    <>
                      <text
                        x={cx}
                        y={textY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={fsS}
                        fontWeight="600"
                        fontFamily="ui-sans-serif, system-ui, sans-serif"
                        fill={labelColor}
                        style={{ userSelect: "none" }}
                      >
                        {editorStr}
                      </text>
                      {wfStr && (
                        <text
                          x={cx}
                          y={textY + lineH}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={fsS}
                          fontFamily="ui-sans-serif, system-ui, sans-serif"
                          fill={labelColor}
                          style={{ userSelect: "none" }}
                        >
                          {wfStr}
                        </text>
                      )}
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
