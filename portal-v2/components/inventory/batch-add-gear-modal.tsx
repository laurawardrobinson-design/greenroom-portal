"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { GEAR_CATEGORIES } from "@/lib/constants/categories";
import { Plus, Trash2 } from "lucide-react";

interface RowData {
  id: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
}

function emptyRow(): RowData {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: "",
    brand: "",
    model: "",
    serialNumber: "",
  };
}

export function BatchAddGearModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<RowData[]>(() => [
    emptyRow(),
    emptyRow(),
    emptyRow(),
  ]);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<
    { idx: number; status: "ok" | "error"; message?: string }[]
  >([]);
  const tableRef = useRef<HTMLDivElement>(null);

  function updateRow(id: string, field: keyof RowData, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
    // Clear results when editing
    if (results.length > 0) setResults([]);
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
    // Scroll to bottom after render
    setTimeout(() => {
      tableRef.current?.scrollTo({
        top: tableRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  }

  function removeRow(id: string) {
    setRows((prev) => {
      if (prev.length <= 1) return prev; // Keep at least 1 row
      return prev.filter((r) => r.id !== id);
    });
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIndex: number, field: string) => {
      if (e.key === "Tab" && !e.shiftKey) {
        // If tabbing from last field of last row, add a new row
        if (rowIndex === rows.length - 1 && field === "serialNumber") {
          e.preventDefault();
          addRow();
          // Focus first field of new row after render
          setTimeout(() => {
            const inputs = tableRef.current?.querySelectorAll("input");
            if (inputs) {
              const lastRowStart = inputs.length; // New row inputs not yet in DOM
              // Will focus via autoFocus on new row
            }
          }, 50);
        }
      }
    },
    [rows.length]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Filter to rows that have at least a name
    const validRows = rows.filter((r) => r.name.trim());
    if (validRows.length === 0) {
      toast("error", "Enter at least one item name");
      return;
    }

    setSaving(true);
    const newResults: typeof results = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.name.trim()) {
        // Skip empty rows
        continue;
      }

      try {
        const res = await fetch("/api/gear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name.trim(),
            category: row.category || "Other",
            brand: row.brand.trim(),
            model: row.model.trim(),
            serialNumber: row.serialNumber.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        newResults.push({ idx: i, status: "ok" });
      } catch (err) {
        newResults.push({
          idx: i,
          status: "error",
          message: err instanceof Error ? err.message : "Failed",
        });
      }
    }

    setResults(newResults);
    const successCount = newResults.filter((r) => r.status === "ok").length;
    const failCount = newResults.filter((r) => r.status === "error").length;

    if (failCount === 0) {
      toast("success", `${successCount} item${successCount !== 1 ? "s" : ""} added`);
      setRows([emptyRow(), emptyRow(), emptyRow()]);
      setResults([]);
      onCreated();
    } else {
      toast(
        "error",
        `${successCount} added, ${failCount} failed — fix errors and retry`
      );
      // Remove successful rows, keep failed ones
      const failedIndices = new Set(
        newResults.filter((r) => r.status === "error").map((r) => r.idx)
      );
      setRows((prev) => prev.filter((_, i) => failedIndices.has(i)));
      if (successCount > 0) onCreated();
    }

    setSaving(false);
  }

  function getRowResult(rowIndex: number) {
    return results.find((r) => r.idx === rowIndex);
  }

  const filledCount = rows.filter((r) => r.name.trim()).length;

  return (
    <Modal open={open} onClose={onClose} title="Batch Add Gear" size="xl">
      <form onSubmit={handleSubmit}>
        <p className="text-xs text-text-secondary mb-3">
          Enter multiple items at once. Only Name is required — tab through fields to move between rows.
        </p>

        <div
          ref={tableRef}
          className="overflow-auto max-h-[400px] rounded-lg border border-border"
        >
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-secondary">
              <tr>
                <th className="border-b border-r border-border px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-secondary w-[22%]">
                  Name *
                </th>
                <th className="border-b border-r border-border px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-secondary w-[18%]">
                  Category
                </th>
                <th className="border-b border-r border-border px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-secondary w-[18%]">
                  Brand
                </th>
                <th className="border-b border-r border-border px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-secondary w-[18%]">
                  Model
                </th>
                <th className="border-b border-r border-border px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-secondary w-[18%]">
                  Serial #
                </th>
                <th className="border-b border-border w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const result = getRowResult(i);
                const rowBg =
                  result?.status === "error"
                    ? "bg-red-50"
                    : result?.status === "ok"
                    ? "bg-green-50"
                    : "";
                return (
                  <tr
                    key={row.id}
                    className={`${i > 0 ? "border-t border-border" : ""} ${rowBg}`}
                  >
                    <td className="border-r border-border p-0">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) =>
                          updateRow(row.id, "name", e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(e, i, "name")}
                        placeholder="Item name"
                        autoFocus={i === rows.length - 1 && rows.length > 3}
                        className="w-full h-9 bg-transparent px-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:outline-none focus:bg-primary/[0.03] transition-colors"
                      />
                    </td>
                    <td className="border-r border-border p-0">
                      <select
                        value={row.category}
                        onChange={(e) =>
                          updateRow(row.id, "category", e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(e, i, "category")}
                        className="w-full h-9 bg-transparent px-2 text-sm text-text-primary focus:outline-none focus:bg-primary/[0.03] transition-colors appearance-none cursor-pointer"
                      >
                        <option value="">—</option>
                        {GEAR_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-r border-border p-0">
                      <input
                        type="text"
                        value={row.brand}
                        onChange={(e) =>
                          updateRow(row.id, "brand", e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(e, i, "brand")}
                        placeholder="Brand"
                        className="w-full h-9 bg-transparent px-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:outline-none focus:bg-primary/[0.03] transition-colors"
                      />
                    </td>
                    <td className="border-r border-border p-0">
                      <input
                        type="text"
                        value={row.model}
                        onChange={(e) =>
                          updateRow(row.id, "model", e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(e, i, "model")}
                        placeholder="Model"
                        className="w-full h-9 bg-transparent px-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:outline-none focus:bg-primary/[0.03] transition-colors"
                      />
                    </td>
                    <td className="border-r border-border p-0">
                      <input
                        type="text"
                        value={row.serialNumber}
                        onChange={(e) =>
                          updateRow(row.id, "serialNumber", e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(e, i, "serialNumber")}
                        placeholder="Serial #"
                        className="w-full h-9 bg-transparent px-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:outline-none focus:bg-primary/[0.03] transition-colors"
                      />
                    </td>
                    <td className="p-0">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="flex h-9 w-full items-center justify-center text-text-tertiary/50 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Remove row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Error details */}
        {results.some((r) => r.status === "error") && (
          <div className="mt-2 text-xs text-red-600 space-y-0.5">
            {results
              .filter((r) => r.status === "error")
              .map((r) => (
                <p key={r.idx}>
                  Row {r.idx + 1}: {r.message}
                </p>
              ))}
          </div>
        )}

        <button
          type="button"
          onClick={addRow}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add row
        </button>

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={filledCount === 0}>
            Add {filledCount > 0 ? `${filledCount} Item${filledCount !== 1 ? "s" : ""}` : "Items"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
