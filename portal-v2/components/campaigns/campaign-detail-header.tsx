"use client";

import { useState } from "react";
import type { Campaign, CampaignStatus } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Trash2, X, Check } from "lucide-react";
import { CopyButton } from "./copy-button";

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

  // Build the title with WF number + campaign name
  const titleParts: string[] = [];
  if (campaign.wfNumber) {
    titleParts.push(campaign.wfNumber);
  }
  titleParts.push(campaign.name);
  const title = titleParts.join(" ");

  return (
    <div className="space-y-2">
      {/* Cancelled state banner */}
      {isCancelled && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2">
          <X className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-base font-medium text-red-700">
            This campaign has been cancelled and cannot be edited.
          </p>
        </div>
      )}

      {/* Page header with breadcrumb and title */}
      {editingField === "name" ? (
        <div className="space-y-3 pb-4 border-b border-border">
          <button
            onClick={cancelEdit}
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            ← Campaigns
          </button>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit("name");
                  if (e.key === "Escape") cancelEdit();
                }}
                className={`text-2xl font-bold bg-transparent border-b-2 focus:outline-none flex-1 ${
                  editError
                    ? "text-error border-error text-text-primary"
                    : "text-text-primary border-primary"
                }`}
              />
              <button onClick={() => saveEdit("name")} className="text-primary hover:text-primary/80 shrink-0 pt-1">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={cancelEdit} className="text-text-tertiary hover:text-text-primary shrink-0 pt-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            {editError && (
              <div className="flex items-center justify-between gap-2 rounded px-2 py-1 bg-error/10">
                <p className="text-sm text-error">{editError}</p>
                <button
                  onClick={revertEdit}
                  className="text-sm text-error hover:text-error/80 underline"
                >
                  Revert
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <PageHeader
          breadcrumb="Campaigns"
          breadcrumbHref="/campaigns"
          title={
            <span
              className={canEdit && !isCancelled ? "cursor-pointer hover:text-primary/80 transition-colors" : ""}
              onClick={() => canEdit && !isCancelled && startEdit("name", campaign.name)}
            >
              {title}
            </span>
          }
          actions={
            isAdmin ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete campaign"
                className="text-text-tertiary hover:text-error"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Copy button below header */}
      {!editingField && (
        <div className="flex items-center gap-2 -mt-2">
          <CopyButton value={title} />
        </div>
      )}

      {/* Delete confirmation */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Campaign"
        size="sm"
      >
        <p className="text-base text-text-secondary">
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
