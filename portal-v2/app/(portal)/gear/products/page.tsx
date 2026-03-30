"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import type { Product, ProductDepartment } from "@/types/domain";
import { PRODUCT_DEPARTMENTS } from "@/lib/validation/products.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { Drawer } from "@/components/ui/drawer";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  Plus,
  Search,
  ShoppingBasket,
  ArrowLeft,
  Edit2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const DEPT_COLORS: Record<string, string> = {
  Deli: "bg-orange-50 text-orange-700",
  Bakery: "bg-amber-50 text-amber-700",
  "Meat-Seafood": "bg-red-50 text-red-700",
  Produce: "bg-emerald-50 text-emerald-700",
  Grocery: "bg-blue-50 text-blue-700",
  Floral: "bg-pink-50 text-pink-700",
  Other: "bg-slate-50 text-slate-600",
};

export default function ProductDirectoryPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<ProductDepartment | "">("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (deptFilter) params.set("department", deptFilter);
  const qs = params.toString();

  const { data: products = [], isLoading, mutate } = useSWR<Product[]>(
    `/api/products${qs ? `?${qs}` : ""}`,
    fetcher
  );

  const canEdit =
    user?.role === "Admin" ||
    user?.role === "Producer" ||
    user?.role === "Art Director" ||
    user?.role === "Studio";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/inventory"
            className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Product Directory
            </h2>
            <p className="text-sm text-text-secondary">
              {products.length} product{products.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setDeptFilter("")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              deptFilter === ""
                ? "bg-text-primary text-white"
                : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
            }`}
          >
            All
          </button>
          {PRODUCT_DEPARTMENTS.map((dept) => (
            <button
              key={dept}
              onClick={() =>
                setDeptFilter(deptFilter === dept ? "" : dept)
              }
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                deptFilter === dept
                  ? "bg-text-primary text-white"
                  : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary shadow-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none sm:w-56"
          />
        </div>
      </div>

      {/* Product grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={<ShoppingBasket className="h-5 w-5" />}
          title={search || deptFilter ? "No products match your filters" : "No products yet"}
          description={
            search || deptFilter
              ? "Try adjusting your search or department filter."
              : "Start building your product directory by adding products used in shoots."
          }
          action={
            canEdit && !search && !deptFilter ? (
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add Product
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className="flex flex-col rounded-xl border border-border bg-surface p-4 text-left hover:bg-surface-secondary transition-colors"
            >
              <div className="flex items-start gap-3">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-14 w-14 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-tertiary shrink-0">
                    <ShoppingBasket className="h-6 w-6 text-text-tertiary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {product.name}
                  </p>
                  <Badge
                    variant="custom"
                    className={`mt-1 ${DEPT_COLORS[product.department] || DEPT_COLORS.Other}`}
                  >
                    {product.department}
                  </Badge>
                </div>
              </div>
              {product.shootingNotes && (
                <p className="mt-2 text-xs text-text-secondary line-clamp-2">
                  {product.shootingNotes}
                </p>
              )}
              {product.restrictions && (
                <p className="mt-1 text-xs text-amber-600 font-medium">
                  {product.restrictions}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Add/Edit Product Drawer */}
      <ProductFormDrawer
        open={showAdd || !!editingProduct}
        onClose={() => { setShowAdd(false); setEditingProduct(null); }}
        product={editingProduct}
        onSaved={() => { setShowAdd(false); setEditingProduct(null); mutate(); }}
      />

      {/* Product Detail Drawer */}
      {selectedProduct && (
        <ProductDetailDrawer
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onEdit={() => { setEditingProduct(selectedProduct); setSelectedProduct(null); }}
          onDeleted={() => { setSelectedProduct(null); mutate(); }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

// --- Product Form Drawer (Add / Edit) ---
function ProductFormDrawer({
  open,
  onClose,
  product,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(product?.name || "");
  const [department, setDepartment] = useState<ProductDepartment>(
    product?.department || "Produce"
  );
  const [description, setDescription] = useState(product?.description || "");
  const [shootingNotes, setShootingNotes] = useState(product?.shootingNotes || "");
  const [restrictions, setRestrictions] = useState(product?.restrictions || "");
  const [rpGuideUrl, setRpGuideUrl] = useState(product?.rpGuideUrl || "");
  const [imageUrl, setImageUrl] = useState<string | null>(product?.imageUrl || null);
  const imageFileRef = useRef<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset form when product changes
  useState(() => {
    if (product) {
      setName(product.name);
      setDepartment(product.department);
      setDescription(product.description);
      setShootingNotes(product.shootingNotes);
      setRestrictions(product.restrictions);
      setRpGuideUrl(product.rpGuideUrl || "");
      setImageUrl(product.imageUrl || null);
      imageFileRef.current = null;
    } else {
      setName("");
      setDepartment("Produce");
      setDescription("");
      setShootingNotes("");
      setRestrictions("");
      setRpGuideUrl("");
      setImageUrl(null);
      imageFileRef.current = null;
    }
  });

  async function uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "products");
    const res = await fetch("/api/upload-image", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Image upload failed");
    return data.url;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast("error", "Product name is required");
      return;
    }
    setSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFileRef.current) {
        finalImageUrl = await uploadImage(imageFileRef.current);
      }
      const body = {
        name: name.trim(),
        department,
        description,
        shootingNotes,
        restrictions,
        rpGuideUrl: rpGuideUrl || null,
        imageUrl: finalImageUrl || null,
      };

      const url = product ? `/api/products/${product.id}` : "/api/products";
      const method = product ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", product ? "Product updated" : "Product added");
      onSaved();
    } catch {
      toast("error", "Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={product ? "Edit Product" : "Add Product"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ImageUpload
          value={imageUrl}
          onFileSelected={(file) => { imageFileRef.current = file; }}
          onRemove={() => { imageFileRef.current = null; setImageUrl(null); }}
        />
        <Input
          label="Product Name"
          placeholder="e.g., Organic Hass Avocado"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          label="Department"
          value={department}
          onChange={(e) => setDepartment(e.target.value as ProductDepartment)}
          options={PRODUCT_DEPARTMENTS.map((d) => ({ value: d, label: d }))}
        />
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="General product description..."
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Shooting Notes
          </label>
          <textarea
            value={shootingNotes}
            onChange={(e) => setShootingNotes(e.target.value)}
            placeholder="How should this product be photographed? Angles, lighting, styling tips..."
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Restrictions
          </label>
          <textarea
            value={restrictions}
            onChange={(e) => setRestrictions(e.target.value)}
            placeholder="Seasonal availability, handling restrictions, legal notes..."
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
        <Input
          label="R&P Guide URL"
          placeholder="https://..."
          value={rpGuideUrl}
          onChange={(e) => setRpGuideUrl(e.target.value)}
        />
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={saving} className="flex-1">
            {product ? "Save Changes" : "Add Product"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

// --- Product Detail Drawer ---
function ProductDetailDrawer({
  product,
  onClose,
  onEdit,
  onDeleted,
  canEdit,
}: {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const { data: historyData } = useSWR(
    `/api/products/${product.id}?history=true`,
    fetcher
  );
  const campaigns = historyData?.campaigns || [];
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Product deleted");
      onDeleted();
    } catch {
      toast("error", "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Drawer open={true} onClose={onClose} title={product.name} size="lg">
      <div className="space-y-5">
        {/* Image + department */}
        <div className="flex items-start gap-4">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-20 w-20 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-tertiary">
              <ShoppingBasket className="h-8 w-8 text-text-tertiary" />
            </div>
          )}
          <div>
            <Badge
              variant="custom"
              className={DEPT_COLORS[product.department] || DEPT_COLORS.Other}
            >
              {product.department}
            </Badge>
            {product.description && (
              <p className="mt-2 text-sm text-text-secondary">{product.description}</p>
            )}
          </div>
        </div>

        {/* Shooting Notes */}
        {product.shootingNotes && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1">
              Shooting Notes
            </p>
            <p className="text-sm text-text-primary whitespace-pre-wrap">
              {product.shootingNotes}
            </p>
          </div>
        )}

        {/* Restrictions */}
        {product.restrictions && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1">
              Restrictions
            </p>
            <p className="text-sm text-amber-700 font-medium">
              {product.restrictions}
            </p>
          </div>
        )}

        {/* R&P Guide */}
        {product.rpGuideUrl && (
          <a
            href={product.rpGuideUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View R&P Guide
          </a>
        )}

        {/* Campaign History */}
        {campaigns.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
              Campaign History
            </p>
            <div className="space-y-1.5">
              {campaigns.map((c: { campaignId: string; campaignName: string; wfNumber: string }) => (
                <Link
                  key={c.campaignId}
                  href={`/campaigns/${c.campaignId}`}
                  className="flex items-center gap-2 rounded-lg bg-surface-secondary p-2.5 text-sm hover:bg-surface-tertiary transition-colors"
                >
                  <span className="text-text-tertiary font-mono text-xs">
                    {c.wfNumber || "—"}
                  </span>
                  <span className="text-text-primary font-medium">
                    {c.campaignName}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {canEdit && (
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button variant="secondary" onClick={onEdit} className="flex-1">
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
