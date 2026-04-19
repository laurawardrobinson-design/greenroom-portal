// Shared helpers for Asset Studio components.

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err: Error & { status?: number } = new Error(
      `Request failed: ${res.status}`
    );
    err.status = res.status;
    throw err;
  }
  return res.json();
};

export function statusPillClass(status: string): string {
  // Pulls colors from the [data-area="asset-studio"] CSS variables defined in globals.css.
  const map: Record<string, string> = {
    // template
    draft:     "bg-[var(--as-surface-2)] text-[var(--as-status-draft)]",
    published: "bg-[var(--as-accent-soft)] text-[var(--as-status-published)]",
    archived:  "bg-[var(--as-surface-2)] text-[var(--as-status-archived)]",
    // run
    queued:     "bg-blue-50 text-[var(--as-status-queued)]",
    running:    "bg-blue-50 text-[var(--as-status-rendering)]",
    succeeded:  "bg-[var(--as-accent-soft)] text-[var(--as-status-completed)]",
    rendering:  "bg-amber-50 text-[var(--as-status-rendering)]",
    completed:  "bg-[var(--as-accent-soft)] text-[var(--as-status-completed)]",
    failed:     "bg-red-50 text-[var(--as-status-failed)]",
    cancelled:  "bg-[var(--as-surface-2)] text-[var(--as-status-cancelled)]",
    // variant
    pending:   "bg-[var(--as-surface-2)] text-[var(--as-status-pending)]",
    rendered:  "bg-blue-50 text-[var(--as-status-rendered)]",
    approved:  "bg-[var(--as-accent-soft)] text-[var(--as-status-approved)]",
    rejected:  "bg-red-50 text-[var(--as-status-rejected)]",
    // DAM placeholder
    ingested:             "bg-[var(--as-surface-2)] text-[var(--as-status-pending)]",
    retouching:           "bg-amber-50 text-[var(--as-status-rendering)]",
    retouched:            "bg-emerald-50 text-[var(--as-status-completed)]",
    versioning:           "bg-blue-50 text-[var(--as-status-rendered)]",
    ready_for_activation: "bg-[var(--as-accent-soft)] text-[var(--as-status-approved)]",
    not_requested:        "bg-[var(--as-surface-2)] text-[var(--as-text-muted)]",
    requested:            "bg-amber-50 text-[var(--as-status-rendering)]",
    in_progress:          "bg-blue-50 text-[var(--as-status-rendered)]",
    pending_sync:         "bg-[var(--as-surface-2)] text-[var(--as-text-muted)]",
    synced:               "bg-[var(--as-accent-soft)] text-[var(--as-status-completed)]",
    stale:                "bg-amber-50 text-[var(--as-status-rendering)]",
    error:                "bg-red-50 text-[var(--as-status-failed)]",
  };
  return `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
    map[status] ?? "bg-[var(--as-surface-2)] text-[var(--as-text-muted)]"
  }`;
}

export function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
