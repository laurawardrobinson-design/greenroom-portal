"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { AppUser, BrandTokenSet } from "@/types/domain";
import { fetcher, fmtRelative } from "./lib";
import { Palette, Type, Image as ImageIcon } from "lucide-react";

// `user` is accepted for parity with sibling tabs but unused today.
interface Props {
  user: AppUser;
}

export function BrandTab(_props: Props) {
  void _props;
  const { data, isLoading } = useSWR<BrandTokenSet[]>(
    "/api/asset-studio/brand-tokens",
    fetcher
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-xl border border-[var(--as-border)] bg-[var(--as-surface)] animate-pulse" />
      </div>
    );
  }

  const active = data?.find((t) => t.isActive);

  if (!active) {
    return (
      <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
        <EmptyState
          title="No active brand tokens"
          description="Run migration 069 to seed Publix brand tokens v1, or add a new version via the API."
        />
      </Card>
    );
  }

  const colors = (active.tokens.colors ?? {}) as Record<string, string>;
  const typo = active.tokens.typography ?? {};
  const logo = active.tokens.logo ?? {};

  return (
    <div className="space-y-4">
      <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--as-text)]">
              {active.brand} · v{active.version}
            </h2>
            <p className="text-sm text-[var(--as-text-muted)]">
              Active since {fmtRelative(active.updatedAt)}
              {active.notes ? ` · ${active.notes}` : ""}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-[var(--as-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--as-status-published)]">
            Active
          </span>
        </div>
      </Card>

      <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
        <div className="mb-3 flex items-center gap-2">
          <Palette className="h-4 w-4 text-[var(--as-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--as-text)]">Colors</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Object.entries(colors).map(([name, hex]) => (
            <div key={name} className="flex flex-col items-start">
              <div
                className="h-12 w-full rounded-md border border-[var(--as-border)]"
                style={{ background: hex }}
              />
              <p className="mt-1 truncate text-xs font-medium text-[var(--as-text)]">{name}</p>
              <p className="text-[11px] text-[var(--as-text-subtle)]">{hex}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
        <div className="mb-3 flex items-center gap-2">
          <Type className="h-4 w-4 text-[var(--as-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--as-text)]">Typography</h3>
        </div>
        <p className="text-sm text-[var(--as-text)]">
          <span className="font-medium">Font family:</span>{" "}
          <span className="text-[var(--as-text-muted)]">
            {String(typo.font_family ?? "—")}
          </span>
        </p>
        {typo.scale && typeof typo.scale === "object" && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(typo.scale as Record<string, number>).map(([k, v]) => (
              <div
                key={k}
                className="rounded-md border border-[var(--as-border)] bg-[var(--as-surface-2)] px-2 py-1.5"
              >
                <p className="text-xs font-medium text-[var(--as-text)]">{k}</p>
                <p className="text-[11px] text-[var(--as-text-subtle)]">{v}px</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
        <div className="mb-3 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-[var(--as-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--as-text)]">Logo</h3>
        </div>
        {logo.primary_url ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={String(logo.primary_url)}
              alt="Brand logo"
              className="h-12 w-auto rounded border border-[var(--as-border)] bg-[var(--as-canvas-bg)] p-1"
            />
            <div className="text-xs text-[var(--as-text-muted)]">
              Min width: {String(logo.min_width_px ?? "—")}px ·
              Clear space: {String(Number(logo.clear_space_pct ?? 0) * 100)}%
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--as-text-muted)]">No primary logo set.</p>
        )}
      </Card>

      <p className="text-xs text-[var(--as-text-subtle)]">
        Editing the active token set is coming in Sprint 2 (Brand Console). For now,
        new versions can be added via{" "}
        <code className="rounded bg-[var(--as-surface-2)] px-1 py-0.5">POST /api/asset-studio/brand-tokens</code>.
      </p>
    </div>
  );
}
