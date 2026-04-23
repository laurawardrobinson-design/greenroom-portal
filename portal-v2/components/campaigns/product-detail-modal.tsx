"use client";

import { useState, useCallback, useEffect } from "react";
import useSWR from "swr";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { X, ExternalLink, AlertTriangle } from "lucide-react";
import type { Product } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error(); return r.json(); });

interface Props {
  productId: string;
  open: boolean;
  onClose: () => void;
}

export function ProductDetailModal({ productId, open, onClose }: Props) {
  const { toast } = useToast();

  const { data: product } = useSWR<Product>(
    open ? `/api/products/${productId}` : null,
    fetcher
  );

  const { data: historyData } = useSWR(
    open ? `/api/products/${productId}?history=true` : null,
    fetcher
  );
  const campaigns: Array<{ campaignId: string; campaignName: string; wfNumber: string }> = historyData?.campaigns || [];

  // Notes
  const { data: notesData, mutate: mutateNotes } = useSWR<Array<{ id: string; text: string; authorName: string; createdAt: string }>>(
    open ? `/api/products/${productId}/notes` : null,
    fetcher
  );
  const notes = notesData || [];

  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => { if (open) setNewNote(""); }, [open]);

  const handleAddNote = useCallback(async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/products/${productId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newNote.trim() }),
      });
      if (!res.ok) throw new Error();
      setNewNote("");
      mutateNotes();
    } catch {
      toast("error", "Failed to add note");
    } finally {
      setAddingNote(false);
    }
  }, [newNote, productId, mutateNotes, toast]);

  if (!product) return null;

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-text-primary">{product.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-medium text-primary">{product.department}</span>
              {product.itemCode && (
                <span className="text-sm font-semibold text-text-primary">{product.itemCode}</span>
              )}
            </div>
          </div>
        </div>

        {/* Image + description */}
        {(product.imageUrl || product.description) && (
          <div className="flex gap-4">
            {product.imageUrl && (
              <div className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-28 w-28 rounded-lg object-cover border border-border"
                />
              </div>
            )}
            {product.description && (
              <p className="text-xs text-text-secondary leading-relaxed">{product.description}</p>
            )}
          </div>
        )}

        {/* Shooting notes */}
        {product.shootingNotes && (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">Shooting Notes</h3>
            <p className="text-xs text-text-secondary">{product.shootingNotes}</p>
          </div>
        )}

        {/* Notes from team */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">Shooting Notes</h3>
          {notes.length > 0 ? (
            <div className="space-y-2 mb-2">
              {notes.map((n) => (
                <div key={n.id} className="flex items-start gap-2">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {n.authorName?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-text-primary">{n.authorName}</span>
                      <span className="text-[10px] text-text-tertiary">
                        {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">{n.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
              placeholder="Add a note..."
              className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddNote}
              disabled={addingNote || !newNote.trim()}
              className="rounded-md bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>

        {/* Restrictions */}
        {product.restrictions && (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">Restrictions</h3>
            <p className="text-xs font-medium text-red-600 italic">{product.restrictions}</p>
          </div>
        )}

        {/* Links */}
        {(product.pcomLink || product.rpGuideUrl) && (
          <div className="flex gap-6">
            {product.pcomLink && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-0.5">Pcom Link</h3>
                <a href={product.pcomLink} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />
                  View on Publix.com
                </a>
              </div>
            )}
            {product.rpGuideUrl && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-0.5">R&P Guide</h3>
                <a href={product.rpGuideUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />
                  View document
                </a>
              </div>
            )}
          </div>
        )}

        {/* Campaign history */}
        {campaigns.length > 0 && (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">Campaign History</h3>
            <div className="space-y-1">
              {campaigns.map((c) => (
                <a key={c.campaignId} href={`/campaigns/${c.campaignId}`}
                  className="flex items-center gap-2 rounded-md bg-surface-secondary px-3 py-1.5 text-xs hover:bg-surface-tertiary transition-colors">
                  {c.wfNumber && <span className="text-text-tertiary">{c.wfNumber}</span>}
                  <span className="font-medium text-text-primary">{c.campaignName}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
