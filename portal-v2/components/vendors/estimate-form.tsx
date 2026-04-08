"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatCurrencyFull } from "@/lib/utils/format";
import { Plus, Trash2, Upload, FileText, PenLine } from "lucide-react";

interface EstimateItem {
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface Props {
  campaignVendorId: string;
  campaignId: string;
  onSubmitted: () => void;
  onCancel: () => void;
}

type UploadResponse = {
  fileUrl?: string;
  url?: string;
  parsedEstimateTotal?: number | null;
};

const COST_CATEGORIES = [
  "Talent",
  "Styling",
  "Equipment Rental",
  "Studio Space",
  "Post-Production",
  "Travel",
  "Catering",
  "Props",
  "Wardrobe",
  "Set Design",
  "Other",
] as const;

type CostCategory = (typeof COST_CATEGORIES)[number];

function normalizeCostCategory(input: string): CostCategory {
  const normalized = input.trim().toLowerCase();
  const match = COST_CATEGORIES.find((category) => category.toLowerCase() === normalized);
  return match ?? "Other";
}

function mapWorkflowErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("not your assignment") ||
    normalized.includes("no access to this campaign")
  ) {
    return "This workflow item belongs to a different vendor login. Refresh and switch to the assigned vendor account.";
  }
  return message;
}

const emptyItem = (): EstimateItem => ({
  category: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  amount: 0,
});

export function EstimateForm({ campaignVendorId, campaignId, onSubmitted, onCancel }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"choose" | "upload" | "manual">("choose");
  const [items, setItems] = useState<EstimateItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [estimateTotal, setEstimateTotal] = useState("");

  function updateItem(index: number, field: keyof EstimateItem, value: unknown) {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        item.amount = Number(item.quantity) * Number(item.unitPrice);
      }
      updated[index] = item;
      return updated;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const manualTotal = items.reduce((sum, item) => sum + item.amount, 0);

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaignId", campaignId);
      formData.append("campaignVendorId", campaignVendorId);
      formData.append("category", "Estimate");

      const res = await fetch("/api/files", { method: "POST", body: formData });
      if (!res.ok) {
        let message = "Upload failed";
        try {
          const data = await res.json();
          if (data?.error) message = data.error as string;
        } catch {
          // no-op
        }
        throw new Error(mapWorkflowErrorMessage(message));
      }
      const data = (await res.json()) as UploadResponse;
      const fileUrl = data.fileUrl || data.url;
      if (!fileUrl) throw new Error("Upload response missing file URL");

      setUploadedFile({ name: file.name, url: fileUrl });
      if (typeof data.parsedEstimateTotal === "number" && data.parsedEstimateTotal > 0) {
        setEstimateTotal(data.parsedEstimateTotal.toFixed(2));
        toast(
          "success",
          `${file.name} uploaded. Detected total ${formatCurrencyFull(data.parsedEstimateTotal)} — please confirm.`
        );
      } else {
        toast("success", `${file.name} uploaded`);
      }
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmitWithFile() {
    if (!uploadedFile) {
      toast("error", "Upload your estimate document first");
      return;
    }
    const total = Number(estimateTotal);
    if (!total || total <= 0) {
      toast("error", "Enter the estimate total");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/campaign-vendors/${campaignVendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_estimate",
          estimateFileUrl: uploadedFile.url,
          estimateFileName: uploadedFile.name,
          items: [{ category: "Other", description: `Per attached: ${uploadedFile.name}`, quantity: 1, unitPrice: total, amount: total }],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(mapWorkflowErrorMessage(data.error || "Failed to submit estimate"));
      }

      toast("success", "Estimate submitted");
      onSubmitted();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitManual(e: React.FormEvent) {
    e.preventDefault();

    const validItems = items.filter((i) => i.description.trim() && i.amount > 0);
    if (validItems.length === 0) {
      toast("error", "Add at least one line item with a description and amount");
      return;
    }
    const normalizedItems = validItems.map((item) => ({
      ...item,
      category: normalizeCostCategory(item.category),
    }));

    setSaving(true);
    try {
      const res = await fetch(`/api/campaign-vendors/${campaignVendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_estimate",
          estimateFileUrl: null,
          estimateFileName: null,
          items: normalizedItems,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(mapWorkflowErrorMessage(data.error || "Failed to submit estimate"));
      }

      toast("success", "Estimate submitted");
      onSubmitted();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSaving(false);
    }
  }

  // --- Choose mode ---
  if (mode === "choose") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          How would you like to submit your estimate?
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface p-6 text-center hover:border-primary hover:bg-primary/5 transition-all"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Upload Estimate</p>
              <p className="text-xs text-text-tertiary mt-1">
                Upload a PDF or document with your estimate
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface p-6 text-center hover:border-primary hover:bg-primary/5 transition-all"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PenLine className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Enter Manually</p>
              <p className="text-xs text-text-tertiary mt-1">
                Type in your line items and amounts
              </p>
            </div>
          </button>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // --- Upload mode ---
  if (mode === "upload") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setMode("choose")}
          className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
        >
          &larr; Back
        </button>

        {/* File upload area */}
        {!uploadedFile ? (
          <label
            className="block cursor-pointer"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileUpload(file);
            }}
          >
            <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface p-8 text-center hover:border-primary hover:bg-primary/5 transition-all">
              <Upload className="h-8 w-8 text-text-tertiary" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {uploading ? "Uploading..." : "Drop your estimate here or click to browse"}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  PDF, Word, or image files accepted
                </p>
              </div>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-secondary p-3">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {uploadedFile.name}
              </p>
              <p className="text-xs text-emerald-600">Uploaded</p>
            </div>
            <button
              type="button"
              onClick={() => setUploadedFile(null)}
              className="text-text-tertiary hover:text-error transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Total amount */}
        <Input
          label="Estimate Total"
          type="number"
          min={0}
          step="0.01"
          placeholder="Enter the total from your estimate"
          value={estimateTotal}
          onChange={(e) => setEstimateTotal(e.target.value)}
        />

        {estimateTotal && Number(estimateTotal) > 0 && (
          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-xs text-text-tertiary uppercase tracking-wider">Total</p>
              <p className="text-xl font-semibold text-text-primary">
                {formatCurrencyFull(Number(estimateTotal))}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitWithFile}
            loading={saving}
            disabled={!uploadedFile || !estimateTotal}
          >
            Submit Estimate
          </Button>
        </div>
      </div>
    );
  }

  // --- Manual entry mode ---
  return (
    <form onSubmit={handleSubmitManual} className="space-y-4">
      <button
        type="button"
        onClick={() => setMode("choose")}
        className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
      >
        &larr; Back
      </button>

      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-lg bg-surface-secondary p-3 space-y-2"
          >
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 sm:col-span-5">
                <Input
                  label={i === 0 ? "Description" : undefined}
                  placeholder="e.g., Full day food styling"
                  value={item.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)}
                />
              </div>
              <div className="col-span-5 sm:col-span-3">
                <Input
                  label={i === 0 ? "Category" : undefined}
                  placeholder="e.g., Styling"
                  value={item.category}
                  onChange={(e) => updateItem(i, "category", e.target.value)}
                />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <Input
                  label={i === 0 ? "Qty" : undefined}
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                />
              </div>
              <div className="col-span-3 sm:col-span-2">
                <Input
                  label={i === 0 ? "Rate" : undefined}
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.unitPrice || ""}
                  placeholder="0.00"
                  onChange={(e) => updateItem(i, "unitPrice", Number(e.target.value))}
                />
              </div>
              <div className="col-span-1 flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                  className="mb-2.5 text-text-tertiary hover:text-error disabled:opacity-30 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {item.amount > 0 && (
              <p className="text-xs text-text-tertiary text-right">
                {formatCurrencyFull(item.amount)}
              </p>
            )}
          </div>
        ))}
      </div>

      <Button type="button" variant="ghost" size="sm" onClick={addItem}>
        <Plus className="h-3.5 w-3.5" />
        Add Line Item
      </Button>

      {/* Total */}
      <div className="flex justify-end border-t border-border pt-4">
        <div className="text-right">
          <p className="text-xs text-text-tertiary uppercase tracking-wider">
            Estimate Total
          </p>
          <p className="text-xl font-semibold text-text-primary">
            {formatCurrencyFull(manualTotal)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Submit Estimate
        </Button>
      </div>
    </form>
  );
}
