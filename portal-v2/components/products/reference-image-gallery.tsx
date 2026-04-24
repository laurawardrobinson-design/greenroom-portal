"use client";

import { useCallback, useRef, useState } from "react";
import useSWR from "swr";
import { Camera, CheckCircle2, Flag, ImagePlus, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import type { ProductImageType, ProductReferenceImage } from "@/types/domain";
import {
  PRODUCT_IMAGE_TYPE_DESCRIPTIONS,
  PRODUCT_IMAGE_TYPE_LABELS,
} from "@/types/domain";
import { useToast } from "@/components/ui/toast";

interface GalleryProps {
  /**
   * Base endpoint for list (GET) + upload (POST).
   *   portal → /api/products/:id/reference-images
   *   rbu    → /api/rbu/:token/products/:id/images
   */
  endpointBase: string;
  /**
   * Controls which actions are surfaced.
   *   "portal" — full: upload any type, promote, delete.
   *   "rbu"    — narrow: upload samples only.
   */
  mode: "portal" | "rbu";
  /** When true, hide management controls (for PR line item preview). */
  readOnly?: boolean;
  className?: string;
}

interface ImagesResponse {
  images: ProductReferenceImage[];
}

const TYPE_ORDER: ProductImageType[] = ["approved", "reference", "sample"];

const TYPE_STYLES: Record<ProductImageType, { chip: string; icon: React.ReactNode }> = {
  reference: {
    chip: "bg-primary-light text-primary",
    icon: <Flag className="h-3 w-3" />,
  },
  sample: {
    chip: "bg-amber-50 text-warning ring-1 ring-inset ring-amber-200",
    icon: <Camera className="h-3 w-3" />,
  },
  approved: {
    chip: "bg-emerald-50 text-success ring-1 ring-inset ring-emerald-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
};

async function fetcher(url: string): Promise<ImagesResponse> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed to load images");
  return r.json();
}

export function ReferenceImageGallery({
  endpointBase,
  mode,
  readOnly = false,
  className = "",
}: GalleryProps) {
  const { data, mutate, isLoading } = useSWR<ImagesResponse>(
    endpointBase,
    fetcher,
    { revalidateOnFocus: false }
  );
  const [uploadType, setUploadType] = useState<ProductImageType>(
    mode === "rbu" ? "sample" : "reference"
  );
  const [uploading, setUploading] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const images = data?.images ?? [];
  const grouped: Record<ProductImageType, ProductReferenceImage[]> = {
    approved: [],
    reference: [],
    sample: [],
  };
  for (const img of images) grouped[img.imageType].push(img);

  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        if (mode === "portal") fd.append("imageType", uploadType);
        const res = await fetch(endpointBase, { method: "POST", body: fd });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({ error: "Upload failed" }))) as {
            error?: string;
          };
          throw new Error(j.error || "Upload failed");
        }
        await mutate();
        toast("success", "Image uploaded");
      } catch (err) {
        toast("error", err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [endpointBase, mode, uploadType, mutate, toast]
  );

  async function handleDelete(imageId: string) {
    if (!confirm("Remove this image?")) return;
    try {
      const res = await fetch(`${endpointBase}/${imageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await mutate();
      toast("success", "Image removed");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActiveMenu(null);
    }
  }

  async function handleSetType(imageId: string, nextType: ProductImageType) {
    try {
      const res = await fetch(`${endpointBase}/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageType: nextType }),
      });
      if (!res.ok) throw new Error("Update failed");
      await mutate();
      toast(
        "success",
        nextType === "approved" ? "Promoted to approved standard" : "Image updated"
      );
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Update failed");
    } finally {
      setActiveMenu(null);
    }
  }

  return (
    <div className={className}>
      {/* Header + upload controls */}
      {!readOnly && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-text-primary">
              Reference images
            </span>
            <span className="text-[11px] text-text-tertiary">
              {images.length} {images.length === 1 ? "image" : "images"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {mode === "portal" && (
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as ProductImageType)}
                className="h-8 rounded-md border border-border bg-surface px-2 text-[12px] text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="reference">Reference — the standard</option>
                <option value="sample">Sample — working attempt</option>
                <option value="approved">Approved — committed</option>
              </select>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading…" : mode === "rbu" ? "Upload sample" : "Upload"}
            </button>
          </div>
        </div>
      )}

      {isLoading && !data ? (
        <div className="h-24 rounded-lg bg-surface-secondary animate-pulse" />
      ) : images.length === 0 ? (
        <EmptyState mode={mode} />
      ) : (
        <div className="space-y-4">
          {TYPE_ORDER.map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const style = TYPE_STYLES[type];
            return (
              <div key={type}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.chip}`}
                  >
                    {style.icon}
                    {PRODUCT_IMAGE_TYPE_LABELS[type]}
                  </span>
                  <span className="text-[11px] text-text-tertiary">
                    {PRODUCT_IMAGE_TYPE_DESCRIPTIONS[type]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {items.map((img) => (
                    <ImageTile
                      key={img.id}
                      image={img}
                      onOpen={() => setLightbox(img.fileUrl)}
                      menuOpen={activeMenu === img.id}
                      onToggleMenu={() =>
                        setActiveMenu((prev) => (prev === img.id ? null : img.id))
                      }
                      canManage={!readOnly && mode === "portal"}
                      onDelete={() => handleDelete(img.id)}
                      onPromote={() => handleSetType(img.id, "approved")}
                      onReset={() => handleSetType(img.id, "sample")}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightbox && (
        <button
          type="button"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-6"
        >
          <img
            src={lightbox}
            alt="Reference"
            className="max-h-[90vh] max-w-[90vw] rounded-xl"
          />
        </button>
      )}
    </div>
  );
}

function EmptyState({ mode }: { mode: "portal" | "rbu" }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-secondary/40 px-4 py-8 text-center">
      <p className="text-sm font-medium text-text-primary">No images yet.</p>
      <p className="mt-1 text-[12px] text-text-tertiary">
        {mode === "rbu"
          ? "Upload a sample of this product so the Brand team can check it against the standard."
          : "Upload a reference image so RBU knows what 'good' looks like. Then promote RBU samples to approved once they clear the bar."}
      </p>
    </div>
  );
}

function ImageTile({
  image,
  onOpen,
  menuOpen,
  onToggleMenu,
  canManage,
  onDelete,
  onPromote,
  onReset,
}: {
  image: ProductReferenceImage;
  onOpen: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  canManage: boolean;
  onDelete: () => void;
  onPromote: () => void;
  onReset: () => void;
}) {
  const attribution = image.uploadedByUserName
    ? image.uploadedByUserName
    : image.uploadedViaRbuDepartment
      ? `${image.uploadedViaRbuDepartment} · RBU`
      : "Unknown";

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={onOpen}
        className="block aspect-square w-full overflow-hidden bg-surface-secondary"
      >
        <img
          src={image.fileUrl}
          alt={image.notes || "Reference image"}
          className="h-full w-full cursor-zoom-in object-cover transition-transform group-hover:scale-[1.02]"
        />
      </button>

      <div className="px-2.5 py-1.5">
        <p className="truncate text-[11px] text-text-secondary">{attribution}</p>
        {image.notes && (
          <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
            {image.notes}
          </p>
        )}
      </div>

      {canManage && (
        <div className="absolute right-1.5 top-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
            className="rounded-md bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70"
            aria-label="Image actions"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>

          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
            >
              {image.imageType === "sample" && (
                <button
                  type="button"
                  onClick={onPromote}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-text-primary hover:bg-surface-secondary"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  Promote to approved
                </button>
              )}
              {image.imageType === "approved" && (
                <button
                  type="button"
                  onClick={onReset}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-text-primary hover:bg-surface-secondary"
                >
                  <Camera className="h-3.5 w-3.5 text-text-tertiary" />
                  Demote to sample
                </button>
              )}
              <button
                type="button"
                onClick={onDelete}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-[12px] text-error hover:bg-error/5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
