"use client";

import { useState } from "react";
import type { Campaign, CampaignStatus } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { ArrowLeft, Trash2, X, Check } from "lucide-react";
import { CopyButton } from "./copy-button";
import Link from "next/link";

interface Props {
  campaign: Campaign;
  canEdit: boolean;
  isAdmin: boolean;
  onStatusChange: (status: CampaignStatus) => void;
  onDelete: () => void;
  deleting: boolean;
  onUpdate: (field: string, value: string | number | null) => void;
}

export function CampaignDetailHeader({
  campaign,
  canEdit,
  isAdmin,
  onStatusChange,
  onDelete,
  deleting,
  onUpdate,
}: Props) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [originalValue, setOriginalValue] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editingWf, setEditingWf] = useState(false);
  const [wfValue, setWfValue] = useState(campaign.wfNumber);

  function startEdit(field: string, currentValue: string) {
    setEditingField(field);
    setEditValue(currentValue);
    setOriginalValue(currentValue);
    setEditError(null);
  }

  function saveEdit(field: string) {
    if (!editValue.trim()) {
      setEditError("Value cannot be empty");
      return;
    }

    try {
      onUpdate(field, editValue);
      setEditingField(null);
      setEditError(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Failed to save");
    }
  }

  function revertEdit() {
    setEditValue(originalValue);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingField(null);
    setEditError(null);
  }

  function saveWfEdit() {
    if (!wfValue.trim()) {
      // Allow empty WF number
    }
    onUpdate("wfNumber", wfValue);
    setEditingWf(false);
  }

  function cancelWfEdit() {
    setWfValue(campaign.wfNumber);
    setEditingWf(false);
  }

  const isCancelled = campaign.status === "Cancelled";

  return (
    <div className="space-y-2">
      {/* Cancelled state banner */}
      {isCancelled && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2">
          <X className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm font-medium text-red-700">
            This campaign has been cancelled and cannot be edited.
          </p>
        </div>
      )}

      {/* Top row: back + actions */}
      <div className="flex items-start gap-3">
        <Link
          href="/campaigns"
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="flex-1 min-w-0">
          {/* WF Number — top line */}
          <div className="flex items-center gap-1.5 mb-0.5">
            {editingWf ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={wfValue}
                  onChange={(e) => setWfValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveWfEdit();
                    if (e.key === "Escape") cancelWfEdit();
                  }}
                  className="text-xs font-mono text-text-primary bg-transparent border-b border-primary focus:outline-none w-24"
                />
                <button onClick={saveWfEdit} className="text-primary hover:text-primary/80">
                  <Check className="h-3 w-3" />
                </button>
                <button onClick={cancelWfEdit} className="text-text-tertiary hover:text-text-primary">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <span
                className={`text-xs font-mono text-text-tertiary ${canEdit && !isCancelled ? "cursor-pointer hover:text-primary" : ""}`}
                onClick={() => canEdit && !isCancelled && setEditingWf(true)}
              >
                {campaign.wfNumber || "—"}
              </span>
            )}
          </div>

          {/* Campaign name + copy — second line */}
          {editingField === "name" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit("name");
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className={`text-2xl font-bold tracking-tight bg-transparent border-b-2 focus:outline-none w-full ${
                    editError
                      ? "text-error border-error text-text-primary"
                      : "text-text-primary border-primary"
                  }`}
                />
                <button onClick={() => saveEdit("name")} className="text-primary hover:text-primary/80">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={cancelEdit} className="text-text-tertiary hover:text-text-primary">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {editError && (
                <div className="flex items-center justify-between gap-2 rounded px-2 py-1 bg-error/10">
                  <p className="text-xs text-error">{editError}</p>
                  <button
                    onClick={revertEdit}
                    className="text-xs text-error hover:text-error/80 underline"
                  >
                    Revert
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2
                className={`text-2xl font-bold tracking-tight text-text-primary truncate ${
                  canEdit && !isCancelled ? "cursor-pointer hover:text-primary transition-colors" : ""
                }`}
                onClick={() => canEdit && !isCancelled && startEdit("name", campaign.name)}
              >
                {campaign.name}
              </h2>
              <CopyButton value={campaign.name} />
            </div>
          )}
        </div>

        {/* Delete — far right (admin only) */}
        {isAdmin && (
          <div className="shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete campaign"
              className="text-text-tertiary hover:text-error"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Campaign"
        size="sm"
      >
        <p className="text-sm text-text-secondary">
          Are you sure you want to delete <strong>{campaign.name}</strong>?
          This will remove all shoots, vendor assignments, deliverables, and
          files associated with this campaign. This cannot be undone.
        </p>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => setShowDeleteConfirm(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleting}
            onClick={() => {
              onDelete();
              setShowDeleteConfirm(false);
            }}
          >
            Delete Campaign
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
