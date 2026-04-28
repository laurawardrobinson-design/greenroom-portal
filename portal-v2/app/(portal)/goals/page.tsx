"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { formatDistanceToNow, parseISO, differenceInMonths } from "date-fns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Card } from "@/components/ui/card";
import { RoleBadge } from "@/components/ui/role-badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import type { UserGoal, GoalMilestone, GoalHighlight, GoalStakeholder, UserRole } from "@/types/domain";
import {
  Search,
  Compass,
  X,
  CheckCircle2,
  Circle,
  Link2,
  Paperclip,
  Sparkles,
  Calendar,
  Send,
  Pencil,
  Upload,
} from "lucide-react";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

interface GoalOverviewUser {
  id: string;
  name: string;
  role: UserRole;
  title: string;
  favoritePublixProduct: string;
  goal: {
    id: string;
    goalText: string;
    currentRoleContext: string;
    updatedAt: string;
    lastActivityAt?: string;
    adviceCount: number;
    milestones?: { total: number; completed: number };
    isStakeholder?: boolean;
  } | null;
}

interface GoalDetailResponse {
  goal: UserGoal | null;
  milestones: GoalMilestone[];
  highlights: GoalHighlight[];
  stakeholders: GoalStakeholder[];
  isPrivateViewer: boolean;
  milestoneProgress?: { total: number; completed: number };
}

const FILTER_ROLES = ["Producer", "Studio"] as const;

export default function GoalsPage() {
  const { user } = useCurrentUser();
  const { data, isLoading } = useSWR<GoalOverviewUser[]>("/api/goals", fetcher);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState<GoalOverviewUser | null>(null);

  if (!user || user.role === "Vendor" || user.role === "Art Director") return null;

  const allUsers = data ?? [];
  const isAdmin = user.role === "Admin";

  // Non-admin users only see their own goal + goals where they are a stakeholder
  const users = isAdmin
    ? allUsers
    : allUsers.filter((u) => u.id === user.id || u.goal?.isStakeholder);

  // Check if current user has a goal set
  const ownEntry = allUsers.find((u) => u.id === user.id);
  const hasOwnGoal = !!ownEntry?.goal;

  const filtered = users.filter((u) => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchGoal = u.goal?.goalText.toLowerCase().includes(q);
      if (!matchName && !matchGoal) return false;
    }
    if (roleFilter && u.role !== roleFilter) return false;
    return true;
  });

  const withGoals = filtered.filter((u) => u.goal);

  return (
    <div className="space-y-4">
      {isAdmin ? (
        <div className="space-y-0">
          <PageHeader title="Team Goals" />
          <div className="border-b border-border"><nav className="ui-tabs">
            <button type="button" onClick={() => setRoleFilter("")} data-state={!roleFilter ? "active" : "inactive"} className="ui-tab">
              All{!roleFilter && <span className="ui-tab-underline" />}
            </button>
            {FILTER_ROLES.map((r) => (
              <button type="button" key={r} onClick={() => setRoleFilter(roleFilter === r ? "" : r)} data-state={roleFilter === r ? "active" : "inactive"} className="ui-tab">
                {r}{roleFilter === r && <span className="ui-tab-underline" />}
              </button>
            ))}
          </nav></div>
        </div>
      ) : (
        <PageHeader title="My Goals" />
      )}

      {!isAdmin && !hasOwnGoal && !isLoading && (
        <div className="rounded-xl border border-border bg-surface-secondary/50 px-4 py-3">
          <p className="text-sm text-text-secondary">
            Want to set a career goal? Talk to your manager to get started.
          </p>
        </div>
      )}

      {isAdmin && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or goal..."
            className="w-full h-10 rounded-lg border border-border bg-surface pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && (
        <>
          {withGoals.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                  Goals in Progress
                </span>
                <span className="text-[10px] text-text-tertiary">{withGoals.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {withGoals.map((u) => (
                  <GoalCard key={u.id} user={u} onSelect={() => setSelectedUser(u)} />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Compass className="h-5 w-5" />}
              title="No goals found"
              description={search || roleFilter ? "Try adjusting your search or filters." : "No one has set a goal yet."}
            />
          )}
        </>
      )}

      <GoalDetailModal
        user={selectedUser}
        currentUserId={user.id}
        currentUserRole={user.role}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  );
}

function GoalCard({ user: u, onSelect }: { user: GoalOverviewUser; onSelect: () => void }) {
  if (!u.goal) return null;

  const isStale = u.goal.lastActivityAt
    ? differenceInMonths(new Date(), parseISO(u.goal.lastActivityAt)) >= 3
    : false;

  return (
    <Card hover padding="none" className="cursor-pointer" onClick={onSelect}>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="relative">
            <UserAvatar name={u.name} favoriteProduct={u.favoritePublixProduct} size="sm" />
            {isStale && u.goal.isStakeholder && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400" title="No activity in 3+ months" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{u.name}</p>
            <p className="text-xs text-text-secondary truncate">{u.title || u.role}</p>
          </div>
          <RoleBadge role={u.role} />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Compass className="h-3 w-3 text-primary shrink-0" />
            <p className="text-xs font-medium text-primary">Working toward</p>
          </div>
          <p className="text-sm text-text-primary line-clamp-2">{u.goal.goalText}</p>
          {u.goal.currentRoleContext && (
            <p className="text-[10px] text-text-tertiary">
              Currently: {u.goal.currentRoleContext}
            </p>
          )}
        </div>

        {u.goal.isStakeholder && u.goal.milestones && u.goal.milestones.total > 0 && (
          <ProgressBar
            completed={u.goal.milestones.completed}
            total={u.goal.milestones.total}
          />
        )}

        <div className="flex items-center justify-end pt-2 border-t border-border">
          <span className="text-[10px] text-text-tertiary">
            {formatDistanceToNow(parseISO(u.goal.updatedAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Card>
  );
}

function GoalDetailModal({
  user: goalUser,
  currentUserId,
  currentUserRole,
  onClose,
}: {
  user: GoalOverviewUser | null;
  currentUserId: string;
  currentUserRole: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: goalData, mutate: mutateGoal } = useSWR<GoalDetailResponse>(
    goalUser ? `/api/users/${goalUser.id}/goal` : null,
    fetcher
  );

  const [goalEditMode, setGoalEditMode] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [goalRoleContext, setGoalRoleContext] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [highlightText, setHighlightText] = useState("");
  const [submittingHighlight, setSubmittingHighlight] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ id: string; fileName: string; fileSize: number }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Reset local state when switching between users
  useEffect(() => {
    setGoalEditMode(false);
    setGoalText("");
    setGoalRoleContext("");
    setNewMilestone("");
    setHighlightText("");
    setPendingFiles([]);
  }, [goalUser?.id]);

  const isOwnProfile = !!goalUser && currentUserId === goalUser.id;
  const canEditGoal = isOwnProfile || currentUserRole === "Admin";
  const isPrivateViewer = goalData?.isPrivateViewer ?? false;

  async function handleSaveGoal() {
    if (!goalText.trim() || !goalUser) return;
    setSavingGoal(true);
    try {
      await fetch(`/api/users/${goalUser.id}/goal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalText: goalText.trim(), currentRoleContext: goalRoleContext.trim() }),
      });
      setGoalEditMode(false);
      mutateGoal();
    } catch {
      toast("error", "Failed to save goal");
    }
    setSavingGoal(false);
  }

  async function handleAddMilestone() {
    if (!newMilestone.trim() || !goalUser) return;
    setAddingMilestone(true);
    try {
      await fetch(`/api/users/${goalUser.id}/goal/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: newMilestone.trim() }),
      });
      setNewMilestone("");
      mutateGoal();
    } catch {
      toast("error", "Failed to add milestone");
    }
    setAddingMilestone(false);
  }

  async function handleToggleMilestone(milestoneId: string, completed: boolean) {
    if (!goalUser) return;
    try {
      await fetch(`/api/users/${goalUser.id}/goal/milestones/${milestoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      mutateGoal();
    } catch {
      toast("error", "Failed to update milestone");
    }
  }

  async function handleDeleteMilestone(milestoneId: string) {
    if (!goalUser) return;
    try {
      await fetch(`/api/users/${goalUser.id}/goal/milestones/${milestoneId}`, { method: "DELETE" });
      mutateGoal();
    } catch {
      toast("error", "Failed to delete milestone");
    }
  }

  async function handleUploadFile(file: File) {
    if (!goalUser) return;
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/users/${goalUser.id}/goal/highlights/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setPendingFiles((prev) => [...prev, { id: data.id, fileName: data.fileName, fileSize: data.fileSize }]);
    } catch {
      toast("error", "Failed to upload file");
    }
    setUploadingFile(false);
  }

  async function handleSubmitHighlight() {
    if (!highlightText.trim() || !goalUser) return;
    setSubmittingHighlight(true);
    try {
      await fetch(`/api/users/${goalUser.id}/goal/highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: highlightText.trim(), links: [], fileIds: pendingFiles.map((f) => f.id) }),
      });
      setHighlightText("");
      setPendingFiles([]);
      mutateGoal();
      toast("success", "Progress update shared!");
    } catch {
      toast("error", "Failed to share update");
    }
    setSubmittingHighlight(false);
  }

  async function handleAddFeedback(highlightId: string, feedbackText: string) {
    if (!goalUser || !feedbackText.trim()) return;
    try {
      await fetch(`/api/users/${goalUser.id}/goal/highlights/${highlightId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: feedbackText.trim() }),
      });
      mutateGoal();
    } catch {
      toast("error", "Failed to add feedback");
    }
  }

  if (!goalUser) return null;

  const goal = goalData?.goal;

  return (
    <Modal open={true} onClose={onClose} size="lg">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="space-y-5">
        {/* Person header */}
        <div className="flex items-start gap-3 pr-8">
          <UserAvatar name={goalUser.name} favoriteProduct={goalUser.favoritePublixProduct} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-semibold text-text-primary">{goalUser.name}</p>
              <RoleBadge role={goalUser.role} />
            </div>
            {goalUser.title && <p className="text-xs text-text-tertiary mt-0.5">{goalUser.title}</p>}
          </div>
        </div>

        {/* Goal text */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
            <Compass className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Working Toward
            </span>
            {canEditGoal && goal && !goalEditMode && (
              <button
                type="button"
                onClick={() => {
                  setGoalText(goal.goalText);
                  setGoalRoleContext(goal.currentRoleContext);
                  setGoalEditMode(true);
                }}
                className="ml-auto flex items-center gap-1 text-[10px] text-text-tertiary hover:text-primary transition-colors"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            )}
            {canEditGoal && !goal && !goalEditMode && (
              <button
                type="button"
                onClick={() => { setGoalText(""); setGoalRoleContext(""); setGoalEditMode(true); }}
                className="ml-auto text-[10px] text-primary hover:text-primary-hover transition-colors"
              >
                + Set a goal
              </button>
            )}
          </div>
          <div className="px-3.5 py-3">
            {goalEditMode ? (
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={goalText}
                  onChange={(e) => setGoalText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveGoal(); } }}
                  placeholder="e.g., Becoming a Designer, learning post-production..."
                  className="w-full h-8 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-colors"
                />
                <input
                  type="text"
                  value={goalRoleContext}
                  onChange={(e) => setGoalRoleContext(e.target.value)}
                  placeholder="Current role (e.g. Production Assistant)"
                  className="w-full h-8 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-colors"
                />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setGoalEditMode(false)} className="text-[10px] text-text-tertiary hover:text-text-secondary px-2 py-1 transition-colors">Cancel</button>
                  <button
                    type="button"
                    onClick={handleSaveGoal}
                    disabled={!goalText.trim() || savingGoal}
                    className="text-[10px] font-medium text-primary hover:text-primary-hover disabled:opacity-40 px-2 py-1 transition-colors"
                  >
                    {savingGoal ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : goal ? (
              <div className="space-y-1">
                <p className="text-sm text-text-primary">{goal.goalText}</p>
                {goal.currentRoleContext && (
                  <p className="text-[10px] text-text-tertiary">Currently: {goal.currentRoleContext}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">No goal set yet.</p>
            )}
          </div>
        </div>

        {/* Private content — owner + stakeholders only */}
        {goal && isPrivateViewer && (
          <>
            {/* Progress bar */}
            {goalData?.milestoneProgress && goalData.milestoneProgress.total > 0 && (
              <ProgressBar
                completed={goalData.milestoneProgress.completed}
                total={goalData.milestoneProgress.total}
              />
            )}

            {/* Milestones */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                  Milestones
                </span>
                {goalData?.milestoneProgress && goalData.milestoneProgress.total > 0 && (
                  <span className="text-[10px] text-text-tertiary ml-auto">
                    {goalData.milestoneProgress.completed} of {goalData.milestoneProgress.total}
                  </span>
                )}
              </div>
              <div className="px-3.5 py-3 space-y-2">
                {goalData?.milestones && goalData.milestones.length > 0 ? (
                  <div className="space-y-1.5">
                    {goalData.milestones.map((m) => (
                      <div key={m.id} className="group flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleMilestone(m.id, !m.completed)}
                          className="shrink-0 mt-0.5"
                        >
                          {m.completed
                            ? <CheckCircle2 className="h-4 w-4 text-primary" />
                            : <Circle className="h-4 w-4 text-text-tertiary hover:text-primary transition-colors" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs ${m.completed ? "text-text-tertiary line-through" : "text-text-primary"}`}>
                            {m.description}
                          </span>
                          {m.targetDate && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-text-tertiary">
                              <Calendar className="h-2.5 w-2.5" />
                              {m.targetDate}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteMilestone(m.id)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 flex h-4 w-4 items-center justify-center rounded text-text-tertiary hover:text-red-500 transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-text-tertiary">No milestones yet.</p>
                )}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newMilestone}
                    onChange={(e) => setNewMilestone(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddMilestone(); } }}
                    placeholder="Add a step..."
                    className="flex-1 h-7 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    disabled={!newMilestone.trim() || addingMilestone}
                    className="flex h-7 px-2.5 items-center rounded-lg bg-primary text-white text-[10px] font-medium disabled:opacity-40 hover:bg-primary-hover transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Progress updates / highlights */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                  Progress Updates
                </span>
              </div>
              <div className="px-3.5 py-3 space-y-3">
                {goalData?.highlights && goalData.highlights.length > 0 ? (
                  <div className="space-y-3 max-h-[280px] overflow-y-auto">
                    {goalData.highlights.map((h) => (
                      <div key={h.id} className="rounded-lg border border-border p-2.5 space-y-2">
                        <div className="flex items-start gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-text-primary break-words">{h.text}</p>
                            <span className="text-[10px] text-text-tertiary">
                              {formatDistanceToNow(parseISO(h.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        {h.links && h.links.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-5">
                            {h.links.map((link, i) => (
                              <a
                                key={i}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary-hover transition-colors"
                              >
                                <Link2 className="h-2.5 w-2.5" />
                                {(() => { try { return new URL(link).hostname; } catch { return link; } })()}
                              </a>
                            ))}
                          </div>
                        )}
                        {h.files && h.files.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-5">
                            {h.files.map((f) => (
                              <a
                                key={f.id}
                                href={f.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded bg-surface-secondary px-2 py-0.5 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
                              >
                                <Paperclip className="h-2.5 w-2.5" />
                                {f.fileName}
                              </a>
                            ))}
                          </div>
                        )}
                        {h.feedback && h.feedback.length > 0 && (
                          <div className="pl-5 space-y-1.5 border-l-2 border-primary/20 ml-1">
                            {h.feedback.map((fb) => (
                              <div key={fb.id} className="flex gap-1.5">
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                  {fb.authorName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[10px] font-medium text-text-primary">{fb.authorName}</span>
                                  <span className="text-[10px] text-text-tertiary ml-1">
                                    {formatDistanceToNow(parseISO(fb.createdAt), { addSuffix: true })}
                                  </span>
                                  <p className="text-[10px] text-text-secondary break-words">{fb.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {!isOwnProfile && isPrivateViewer && (
                          <HighlightFeedbackInput highlightId={h.id} onSubmit={handleAddFeedback} />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-text-tertiary">No updates yet.</p>
                )}
                {isOwnProfile && (
                  <div className="space-y-1.5 rounded-lg border border-dashed border-border p-2.5">
                    <textarea
                      value={highlightText}
                      onChange={(e) => setHighlightText(e.target.value)}
                      placeholder="Share a progress update..."
                      rows={2}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-colors resize-none"
                    />
                    {/* Pending file chips */}
                    {pendingFiles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {pendingFiles.map((f) => (
                          <div key={f.id} className="flex items-center gap-1 rounded bg-surface-secondary px-2 py-0.5 text-[10px] text-text-secondary">
                            <Paperclip className="h-2.5 w-2.5 shrink-0" />
                            <span className="max-w-[120px] truncate">{f.fileName}</span>
                            <button
                              type="button"
                              onClick={() => setPendingFiles((prev) => prev.filter((p) => p.id !== f.id))}
                              className="ml-0.5 text-text-tertiary hover:text-red-500 transition-colors"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFile}
                        className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-primary disabled:opacity-40 transition-colors"
                      >
                        <Upload className="h-3 w-3" />
                        {uploadingFile ? "Uploading..." : "Attach file"}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleUploadFile(f); e.target.value = ""; } }}
                      />
                      <button
                        type="button"
                        onClick={handleSubmitHighlight}
                        disabled={!highlightText.trim() || submittingHighlight}
                        className="flex h-7 px-3 items-center gap-1.5 rounded-lg bg-primary text-white text-[10px] font-medium disabled:opacity-40 hover:bg-primary-hover transition-colors"
                      >
                        <Sparkles className="h-3 w-3" />
                        {submittingHighlight ? "Sharing..." : "Share Update"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </>
        )}
      </div>
    </Modal>
  );
}

function HighlightFeedbackInput({
  highlightId,
  onSubmit,
}: {
  highlightId: string;
  onSubmit: (id: string, text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    await onSubmit(highlightId, text);
    setText("");
    setSubmitting(false);
  }

  return (
    <div className="flex gap-1.5 pl-5">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        placeholder="Leave feedback..."
        className="flex-1 h-6 rounded border border-border bg-surface px-2 text-[10px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-colors"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!text.trim() || submitting}
        className="flex h-6 px-2 items-center rounded bg-primary text-white text-[10px] disabled:opacity-40 hover:bg-primary-hover transition-colors"
      >
        <Send className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
