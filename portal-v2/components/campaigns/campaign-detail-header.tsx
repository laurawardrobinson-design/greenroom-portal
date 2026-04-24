"use client";

import { useState } from "react";
import type { Campaign, CampaignStatus } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Trash2, X, Check, Mail } from "lucide-react";
import { CopyButton } from "./copy-button";

interface Props {
  campaign: Campaign;
  canEdit: boolean;
  canDelete: boolean;
  onStatusChange: (status: CampaignStatus) => void;
  onDraftEmail?: () => void;
  onDelete: () => void;
  deleting: boolean;
  onUpdate: (field: string, value: string | number | null) => void;
}

export function CampaignDetailHeader({
  campaign,
  canEdit,
  canDelete,
  onStatusChange,
  onDraftEmail,
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

  function saveTitleEdit() {
    const val = editValue.trim();
    if (!val) {
      setEditError("Title cannot be empty");
      return;
    }
    // Parse WF number from beginning if present (WF followed by digits)
    const wfMatch = val.match(/^(WF\d+)\s+(.*)/i);
    try {
      if (wfMatch) {
        const newWf = wfMatch[1].toUpperCase();
        const newName = wfMatch[2].trim();
        if (!newName) {
          setEditError("Campaign name cannot be empty");
          return;
        }
        if (newWf !== campaign.wfNumber) {
          onUpdate("wfNumber", newWf);
        }
        onUpdate("name", newName);
      } else {
        // No WF number in the input — just update name, clear WF if it was there
        onUpdate("name", val);
      }
      setEditingField(null);
      setEditError(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Failed to save");
    }
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
          <X className="h-5 w-5 text-error shrink-0" />
          <p className="text-base font-medium text-error">
            This campaign has been cancelled and cannot be edited.
          </p>
        </div>
      )}

      {/* Page header with breadcrumb and title */}
      <PageHeader
        breadcrumb="Campaigns"
        hideBreadcrumbLabel
        breadcrumbHref="/campaigns"
        showDivider={false}
        title={
          editingField === "name" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitleEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className={`text-2xl font-bold bg-transparent border-b-2 focus:outline-none flex-1 p-0 leading-tight ${
                    editError
                      ? "text-error border-error"
                      : "text-text-primary border-primary"
                  }`}
                />
                <button onClick={saveTitleEdit} className="text-primary hover:text-primary/80 shrink-0">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={cancelEdit} className="text-text-tertiary hover:text-text-primary shrink-0">
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
          ) : (
            <div className="flex flex-wrap items-start gap-2">
              <h1
                className={`break-words text-2xl font-bold text-text-primary ${canEdit && !isCancelled ? "cursor-pointer transition-colors hover:text-primary/80" : ""}`}
                onClick={() => canEdit && !isCancelled && startEdit("name", title)}
              >
                {title}
              </h1>
              <div className="flex shrink-0 items-center gap-1">
                <CopyButton value={title} />
                {onDraftEmail && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDraftEmail}
                    title="Draft Email"
                    className="text-text-tertiary hover:text-text-primary"
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Delete campaign"
                    className="text-text-tertiary hover:text-error"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )
        }
      />

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
