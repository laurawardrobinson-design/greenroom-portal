"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/format";
import type { RateCard } from "@/types/domain";
import { HardHat, Plus, Pencil, Trash2, Check, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function RateCardManagement() {
  const { toast } = useToast();
  const { data: rawRateCards, mutate } = useSWR<RateCard[]>(
    "/api/rate-cards",
    fetcher
  );
  const rateCards = Array.isArray(rawRateCards) ? rawRateCards : [];
  const [adding, setAdding] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [newRate, setNewRate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editRate, setEditRate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!newRole || !newRate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/rate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole, dayRate: Number(newRate) }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", `Rate card added for ${newRole}`);
      setAdding(false);
      setNewRole("");
      setNewRate("");
      mutate();
    } catch {
      toast("error", "Failed to add rate card");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editRole || !editRate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/rate-cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role: editRole, dayRate: Number(editRate) }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Rate card updated");
      setEditingId(null);
      mutate();
    } catch {
      toast("error", "Failed to update rate card");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, role: string) {
    if (!confirm(`Delete ${role} rate card? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/rate-cards?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast("success", `Rate card for ${role} deleted`);
      mutate();
    } catch {
      toast("error", "Failed to delete rate card");
    }
  }

  function startEdit(card: RateCard) {
    setEditingId(card.id);
    setEditRole(card.role);
    setEditRate(String(card.dayRate));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between w-full">
          <span className="flex items-center gap-2">
            <HardHat className="h-4 w-4" />
            Rate Cards
          </span>
          {!adding && (
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add Role
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          <div className="col-span-5">Role</div>
          <div className="col-span-3">Day Rate</div>
          <div className="col-span-4 text-right">Actions</div>
        </div>

        {/* Add new row */}
        {adding && (
          <div className="grid grid-cols-12 gap-3 items-center px-3 py-2 bg-primary/5 rounded-lg">
            <div className="col-span-5">
              <input
                type="text"
                placeholder="Role name"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                autoFocus
                className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </div>
            <div className="col-span-3">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">$</span>
                <input
                  type="number"
                  placeholder="0"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  min={0}
                  step="1"
                  className="w-full rounded border border-border bg-surface pl-5 pr-2 py-1.5 text-sm text-text-primary focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <div className="col-span-4 flex gap-1 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                <X className="h-3 w-3" />
              </Button>
              <Button size="sm" onClick={handleAdd} loading={saving}>
                <Check className="h-3 w-3" />
                Save
              </Button>
            </div>
          </div>
        )}

        {/* Existing rate cards */}
        {rateCards.map((card) => (
          <div
            key={card.id}
            className="grid grid-cols-12 items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-secondary transition-colors"
          >
            {editingId === card.id ? (
              <>
                <div className="col-span-5">
                  <input
                    type="text"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:outline-none"
                  />
                </div>
                <div className="col-span-3">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">$</span>
                    <input
                      type="number"
                      value={editRate}
                      onChange={(e) => setEditRate(e.target.value)}
                      min={0}
                      step="1"
                      className="w-full rounded border border-border bg-surface pl-5 pr-2 py-1.5 text-sm text-text-primary focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
                <div className="col-span-4 flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                  <Button size="sm" onClick={() => handleUpdate(card.id)} loading={saving}>
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="col-span-5">
                  <p className="text-sm font-medium text-text-primary">{card.role}</p>
                </div>
                <div className="col-span-3">
                  <p className="text-sm text-text-primary">{formatCurrency(card.dayRate)}/day</p>
                </div>
                <div className="col-span-4 flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(card)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(card.id, card.role)}
                    className="text-text-tertiary hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}

        {rateCards.length === 0 && !adding && (
          <p className="px-3 py-4 text-sm text-text-tertiary text-center">
            No rate cards configured. Add standard day rates for common crew roles.
          </p>
        )}
      </div>
    </Card>
  );
}
