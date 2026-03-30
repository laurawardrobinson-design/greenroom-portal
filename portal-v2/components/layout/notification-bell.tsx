"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/use-notifications";
import type { Notification } from "@/types/domain";

const LEVEL_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  warning: "bg-amber-400",
  info:    "bg-blue-400",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface NotificationRowProps {
  n: Notification;
  onAction: (n: Notification) => void;
}

function NotificationRow({ n, onAction }: NotificationRowProps) {
  return (
    <button
      onClick={() => onAction(n)}
      className={`
        w-full text-left px-4 py-3 flex gap-3 transition-colors
        ${n.read
          ? "hover:bg-surface-secondary/60"
          : "bg-primary/5 hover:bg-primary/10"}
      `}
    >
      {/* Level dot */}
      <span className="mt-[5px] shrink-0">
        <span className={`block h-2 w-2 rounded-full ${LEVEL_DOT[n.level]}`} />
      </span>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${n.read ? "text-text-secondary" : "text-text-primary font-medium"}`}>
          {n.title}
        </p>
        {n.body && (
          <p className="mt-0.5 text-xs text-text-secondary line-clamp-2 leading-relaxed">
            {n.body}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2">
          {n.campaign && (
            <span className="text-xs text-text-tertiary font-mono">
              {n.campaign.wfNumber}
            </span>
          )}
          <span className="text-xs text-text-tertiary">{timeAgo(n.createdAt)}</span>
        </div>
      </div>

      {!n.read && (
        <span className="mt-1 shrink-0 h-2 w-2 rounded-full bg-primary" />
      )}
    </button>
  );
}

interface NotificationBellProps {
  /** "sidebar" renders as icon-only for the dark sidebar; "topbar" for white topbar */
  variant?: "sidebar" | "topbar";
}

export function NotificationBell({ variant = "topbar" }: NotificationBellProps) {
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleNotificationClick(n: Notification) {
    if (!n.read) await markRead(n.id);
    setOpen(false);
    if (n.campaignId) router.push(`/campaigns/${n.campaignId}`);
  }

  const buttonBase =
    variant === "sidebar"
      ? "relative flex h-9 w-9 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white transition-colors"
      : "relative flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors";

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={buttonBase}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute z-50 w-96 rounded-xl border border-border bg-surface shadow-xl overflow-hidden ${variant === "sidebar" ? "bottom-full mb-2 left-0" : "top-full mt-2 right-0"}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={async () => { await markAllRead(); }}
                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border/50">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="text-sm text-text-secondary">Loading…</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Check className="h-8 w-8 text-text-tertiary" />
                <p className="text-sm text-text-secondary">You&apos;re all caught up</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationRow key={n.id} n={n} onAction={handleNotificationClick} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
