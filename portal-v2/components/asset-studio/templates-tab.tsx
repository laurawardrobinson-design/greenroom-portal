"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { AppUser, AssetTemplate, TemplateStatus } from "@/types/domain";
import { fetcher, statusPillClass, fmtRelative } from "./lib";
import { Plus, Search, Pencil, ImageIcon, History } from "lucide-react";

interface Props {
  user: AppUser;
}

const STATUS_OPTIONS: Array<{ value: "" | TemplateStatus; label: string }> = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function TemplatesTab({ user }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | TemplateStatus>("");
  const [showCreate, setShowCreate] = useState(false);

  const canManage = ["Admin", "Producer", "Post Producer", "Designer"].includes(user.role);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  const qs = params.toString();
  const url = `/api/asset-studio/templates${qs ? `?${qs}` : ""}`;
  const { data, isLoading } = useSWR<AssetTemplate[]>(url, fetcher);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--as-text-subtle)]" />
            <Input
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value || "all"}
                onClick={() => setStatus(opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  status === opt.value
                    ? "bg-[var(--as-accent-soft)] text-[var(--as-accent)]"
                    : "text-[var(--as-text-muted)] hover:bg-[var(--as-surface-2)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="h-4 w-4" />
            New template
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-xl border border-[var(--as-border)] bg-[var(--as-surface)] animate-pulse"
            />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
          <EmptyState
            title={search || status ? "No matching templates" : "No templates yet"}
            description={
              search || status
                ? "Try clearing your filters."
                : canManage
                  ? "Create a template to start generating variants."
                  : "Templates will appear here once a Designer adds one."
            }
            action={
              canManage && !search && !status ? (
                <Button onClick={() => setShowCreate(true)} size="sm">
                  <Plus className="h-4 w-4" />
                  New template
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((t) => (
            <Card
              key={t.id}
              padding="none"
              className="overflow-hidden border-[var(--as-border)] bg-[var(--as-surface)] transition-shadow hover:shadow-md"
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-[var(--as-surface-2)]">
                {t.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.thumbnailUrl}
                    alt={t.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <ImageIcon className="h-10 w-10 text-[var(--as-text-subtle)]" />
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-[var(--as-text)]">
                      {t.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--as-text-muted)]">
                      {t.canvasWidth}×{t.canvasHeight} · {fmtRelative(t.updatedAt)}
                    </p>
                  </div>
                  <span className={statusPillClass(t.status)}>{t.status}</span>
                </div>
                {canManage && (
                  <div className="mt-3 flex justify-end gap-2">
                    <Link href={`/asset-studio/templates/${t.id}/edit?versions=open`}>
                      <Button variant="outline" size="sm">
                        <History className="h-3.5 w-3.5" />
                        Versions
                      </Button>
                    </Link>
                    <Link href={`/asset-studio/templates/${t.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTemplateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            mutate(url);
          }}
        />
      )}
    </div>
  );
}

function CreateTemplateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (template: AssetTemplate) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [widthInput, setWidthInput] = useState("1080");
  const [heightInput, setHeightInput] = useState("1080");
  const [busy, setBusy] = useState(false);

  function normalizePx(raw: string, fallback: number): number {
    const parsed = Number(raw.trim());
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(100, Math.min(4000, Math.round(parsed)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const width = normalizePx(widthInput, 1080);
    const height = normalizePx(heightInput, 1080);
    setBusy(true);
    try {
      const res = await fetch("/api/asset-studio/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          canvasWidth: width,
          canvasHeight: height,
          seedDefaultSpecs: true,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const created: AssetTemplate = await res.json();
      toast("success", "Template created");
      onCreated(created);
      router.push(`/asset-studio/templates/${created.id}/edit`);
    } catch (err) {
      console.error(err);
      toast("error", "Couldn't create template");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New template">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--as-text-muted)]">
            Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekly Ad — Hero"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--as-text-muted)]">
            Description (optional)
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this template for?"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--as-text-muted)]">
              Canvas width (px)
            </label>
            <Input
              type="number"
              min={100}
              max={4000}
              value={widthInput}
              onChange={(e) => setWidthInput(e.target.value)}
              onBlur={() =>
                setWidthInput(String(normalizePx(widthInput, 1080)))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--as-text-muted)]">
              Canvas height (px)
            </label>
            <Input
              type="number"
              min={100}
              max={4000}
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
              onBlur={() =>
                setHeightInput(String(normalizePx(heightInput, 1080)))
              }
            />
          </div>
        </div>
        <p className="text-xs text-[var(--as-text-subtle)]">
          The default Storyteq output sizes (1:1, 4:5, 9:16) will be added automatically.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
