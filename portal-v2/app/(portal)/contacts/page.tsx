"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { AppUser, Vendor, UserGoal } from "@/types/domain";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useVendors } from "@/hooks/use-vendors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PUBLIX_PRODUCTS, getProductIcon } from "@/components/onboarding/onboarding-modal";
import { VENDOR_CATEGORIES } from "@/lib/constants/categories";
import {
  Plus,
  Search,
  Mail,
  Phone,
  Users,
  Building2,
  LayoutGrid,
  List,
  Coffee,
  Cookie,
  AlertCircle,
  X,
  Edit2,
  Heart,
  Send,
  Compass,
  Pencil,
} from "lucide-react";
import { PageTabs } from "@/components/ui/page-tabs";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

type Tab = "team" | "vendors";

const ROLE_BADGE: Record<string, string> = {
  Admin: "bg-purple-50 text-purple-700",
  Producer: "bg-blue-50 text-blue-700",
  Studio: "bg-teal-50 text-teal-700",
};

const ROLES = ["Admin", "Producer", "Studio"] as const;

export default function ContactsPage() {
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("team");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const canEdit = user?.role === "Admin" || user?.role === "Producer" || user?.role === "Post Producer";

  function switchTab(t: Tab) {
    setTab(t);
    setSearch("");
    setRoleFilter("");
    setCategoryFilter("");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Contacts</h2>
        <p className="text-sm text-text-secondary">
          {tab === "team" ? "Internal team members" : "External vendors and partners"}
        </p>
      </div>

      <PageTabs
        tabs={[
          { key: "team", label: "Internal Team", icon: Users },
          { key: "vendors", label: "External Vendors", icon: Building2 },
        ]}
        activeTab={tab}
        onTabChange={(key) => switchTab(key as Tab)}
      />

      {/* Search + filter bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder={tab === "team" ? "Search team members..." : "Search vendors..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
          <div className="ml-auto flex items-center gap-1">
            {canEdit && (
              <button
                onClick={() => tab === "team" ? setShowAddTeam(true) : setShowAddVendor(true)}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
                title={tab === "team" ? "Add team member" : "Add vendor"}
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setViewMode("grid")}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === "grid" ? "bg-surface-secondary text-text-primary" : "text-text-tertiary hover:text-text-secondary"}`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === "list" ? "bg-surface-secondary text-text-primary" : "text-text-tertiary hover:text-text-secondary"}`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {tab === "team" ? (
            <>
              <button
                onClick={() => setRoleFilter("")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  !roleFilter ? "bg-text-primary text-white" : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                }`}
              >
                All
              </button>
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(roleFilter === r ? "" : r)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    roleFilter === r ? "bg-text-primary text-white" : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                  }`}
                >
                  {r}
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => setCategoryFilter("")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  !categoryFilter ? "bg-text-primary text-white" : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                }`}
              >
                All
              </button>
              {VENDOR_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(categoryFilter === c ? "" : c)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    categoryFilter === c ? "bg-text-primary text-white" : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                  }`}
                >
                  {c}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {tab === "team" ? (
        <TeamSection
          search={search}
          roleFilter={roleFilter}
          viewMode={viewMode}
          canEdit={canEdit}
          showAdd={showAddTeam}
          onOpenAdd={() => setShowAddTeam(true)}
          onCloseAdd={() => setShowAddTeam(false)}
        />
      ) : (
        <VendorSection
          search={search}
          categoryFilter={categoryFilter}
          viewMode={viewMode}
          canEdit={canEdit}
          showAdd={showAddVendor}
          onOpenAdd={() => setShowAddVendor(true)}
          onCloseAdd={() => setShowAddVendor(false)}
        />
      )}
    </div>
  );
}

// --- Internal Team Section ---
function TeamSection({
  search,
  roleFilter,
  viewMode,
  canEdit,
  showAdd,
  onOpenAdd,
  onCloseAdd,
}: {
  search: string;
  roleFilter: string;
  viewMode: "grid" | "list";
  canEdit: boolean;
  showAdd: boolean;
  onOpenAdd: () => void;
  onCloseAdd: () => void;
}) {
  const { data: rawAllUsers, isLoading, mutate } = useSWR<AppUser[]>(
    "/api/users?roles=Admin,Producer,Studio",
    fetcher,
    { revalidateOnFocus: false }
  );
  const allUsers: AppUser[] = Array.isArray(rawAllUsers) ? rawAllUsers : [];
  const [detailPerson, setDetailPerson] = useState<AppUser | null>(null);

  const filtered = allUsers.filter((u) => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.title?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <>
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={search || roleFilter ? "No matches" : "No team members yet"}
          description={search || roleFilter ? "Try adjusting your search or filter." : "Add your internal team members."}
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((person) => (
            <Card
              key={person.id}
              hover
              padding="md"
              className="cursor-pointer"
              onClick={() => setDetailPerson(person)}
            >
              <div className="flex items-start gap-3">
                <UserAvatar name={person.name} favoriteProduct={person.favoritePublixProduct} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-semibold text-text-primary truncate">{person.name}</h3>
                  </div>
                  {person.title && (
                    <p className="text-xs text-text-secondary mb-1">{person.title}</p>
                  )}
                  <div className="space-y-0.5 text-xs text-text-tertiary">
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3 w-3 shrink-0" />
                      {person.email}
                    </p>
                    {person.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0" />
                        {person.phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border-light space-y-2">
                {(person.favoriteDrinks || person.favoriteSnacks || person.dietaryRestrictions || person.allergies) ? (
                  <>
                    {person.favoriteDrinks && (
                      <div className="flex items-start gap-2">
                        <Coffee className="h-3 w-3 shrink-0 mt-1 text-text-tertiary" />
                        <div className="flex flex-wrap gap-1">
                          {person.favoriteDrinks.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                            <span key={item} className="rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] text-text-secondary">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {person.favoriteSnacks && (
                      <div className="flex items-start gap-2">
                        <Cookie className="h-3 w-3 shrink-0 mt-1 text-text-tertiary" />
                        <div className="flex flex-wrap gap-1">
                          {person.favoriteSnacks.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                            <span key={item} className="rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] text-text-secondary">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {person.dietaryRestrictions && (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-3 w-3 shrink-0 mt-1 text-amber-500" />
                        <div className="flex flex-wrap gap-1">
                          {person.dietaryRestrictions.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                            <span key={item} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {person.allergies && (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-3 w-3 shrink-0 mt-1 text-red-500" />
                        <div className="flex flex-wrap gap-1">
                          {person.allergies.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                            <span key={item} className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] text-red-700">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[10px] text-text-tertiary">No preferences set</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_120px_1fr_140px] gap-0 bg-surface-secondary border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            <div>Name</div>
            <div>Role</div>
            <div>Email</div>
            <div>Phone</div>
          </div>
          {filtered.map((person) => (
            <div
              key={person.id}
              role="button"
              tabIndex={0}
              onClick={() => setDetailPerson(person)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailPerson(person); } }}
              className="grid grid-cols-1 sm:grid-cols-[1fr_120px_1fr_140px] gap-0 px-4 py-3 border-b border-border-light last:border-b-0 hover:bg-surface-secondary transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar name={person.name} favoriteProduct={person.favoritePublixProduct} size="xs" />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-text-primary truncate block">{person.name}</span>
                  {person.title && <span className="text-xs text-text-tertiary truncate block">{person.title}</span>}
                </div>
              </div>
              <div className="hidden sm:flex items-center">
                <span className="text-xs text-text-secondary truncate">{person.title || "—"}</span>
              </div>
              <div className="hidden sm:flex items-center">
                <span className="text-xs text-text-secondary truncate">{person.email}</span>
              </div>
              <div className="hidden sm:flex items-center">
                <span className="text-xs text-text-secondary">{person.phone || "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddTeamMemberModal
        open={showAdd}
        onClose={onCloseAdd}
        onCreated={() => { mutate(); onCloseAdd(); }}
      />
      <ContactDetailModal
        person={detailPerson}
        onClose={() => setDetailPerson(null)}
        onSaved={canEdit ? () => { mutate(); setDetailPerson(null); } : undefined}
      />
    </>
  );
}

interface UserNote {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

// --- Contact Detail Modal (unified detail + inline edit) ---
function ContactDetailModal({
  person,
  onClose,
  onSaved,
}: {
  person: AppUser | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // Form state
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [title, setTitle] = useState(person?.title ?? "");
  const [role, setRole] = useState(person?.role ?? "Studio");
  const [favoriteDrinks, setFavoriteDrinks] = useState(person?.favoriteDrinks ?? "");
  const [favoriteSnacks, setFavoriteSnacks] = useState(person?.favoriteSnacks ?? "");
  const [dietaryRestrictions, setDietaryRestrictions] = useState(person?.dietaryRestrictions ?? "");
  const [coffeeOrder, setCoffeeOrder] = useState(person?.energyBoost ?? "");
  const [allergies, setAllergies] = useState(person?.allergies ?? "");
  const [selectedProduct, setSelectedProduct] = useState(person?.favoritePublixProduct ?? "");

  // Praise notes
  const { user: currentUser } = useCurrentUser();
  const { data: userNotes, mutate: mutateNotes } = useSWR<UserNote[]>(
    person ? `/api/users/${person.id}/notes` : null,
    (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Request failed"); return r.json(); })
  );
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Goal ("Growing Toward")
  interface GoalResponse {
    goal: UserGoal | null;
  }
  const { data: goalData, mutate: mutateGoal } = useSWR<GoalResponse>(
    person ? `/api/users/${person.id}/goal` : null,
    (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Request failed"); return r.json(); })
  );
  const [goalEditMode, setGoalEditMode] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [goalRoleContext, setGoalRoleContext] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  // Reset goal edit state when goal data loads/changes
  useEffect(() => {
    setGoalEditMode(false);
    setGoalText(goalData?.goal?.goalText ?? "");
    setGoalRoleContext(goalData?.goal?.currentRoleContext ?? "");
  }, [goalData?.goal?.goalText, goalData?.goal?.currentRoleContext]);

  const isOwnProfile = !!(currentUser && person && currentUser.id === person.id);
  const canEditGoal = isOwnProfile || currentUser?.role === "Admin";

  async function handleSaveGoal() {
    if (!goalText.trim() || !person) return;
    setSavingGoal(true);
    try {
      await fetch(`/api/users/${person.id}/goal`, {
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

  async function handleClearGoal() {
    if (!person) return;
    setSavingGoal(true);
    try {
      await fetch(`/api/users/${person.id}/goal`, { method: "DELETE" });
      setGoalText("");
      setGoalRoleContext("");
      setGoalEditMode(false);
      mutateGoal();
    } catch {
      toast("error", "Failed to clear goal");
    }
    setSavingGoal(false);
  }

  async function handleAddNote() {
    if (!newNote.trim() || !person) return;
    setAddingNote(true);
    try {
      await fetch(`/api/users/${person.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newNote.trim() }),
      });
      setNewNote("");
      mutateNotes();
    } catch {
      toast("error", "Failed to add note");
    }
    setAddingNote(false);
  }

  async function handleDeleteNote(noteId: string) {
    if (!person) return;
    if (!confirm("Delete this note?")) return;
    try {
      await fetch(`/api/users/${person.id}/notes/${noteId}`, { method: "DELETE" });
      mutateNotes();
    } catch {
      toast("error", "Failed to delete note");
    }
  }

  useEffect(() => {
    if (person) {
      setName(person.name);
      setEmail(person.email);
      setPhone(person.phone || "");
      setTitle(person.title || "");
      setRole(person.role);
      setFavoriteDrinks(person.favoriteDrinks || "");
      setFavoriteSnacks(person.favoriteSnacks || "");
      setDietaryRestrictions(person.dietaryRestrictions || "");
      setCoffeeOrder(person.energyBoost || "");
      setAllergies(person.allergies || "");
      setSelectedProduct(person.favoritePublixProduct || "");
      setEditMode(false);
      setIconPickerOpen(false);
    }
  }, [person]);

  function resetForm() {
    if (!person) return;
    setName(person.name);
    setEmail(person.email);
    setPhone(person.phone || "");
    setTitle(person.title || "");
    setRole(person.role);
    setFavoriteDrinks(person.favoriteDrinks || "");
    setFavoriteSnacks(person.favoriteSnacks || "");
    setDietaryRestrictions(person.dietaryRestrictions || "");
    setCoffeeOrder(person.energyBoost || "");
    setAllergies(person.allergies || "");
    setSelectedProduct(person.favoritePublixProduct || "");
    setEditMode(false);
    setIconPickerOpen(false);
  }

  async function handleSave() {
    if (!person) return;
    if (!name.trim() || !email.trim()) {
      toast("error", "Name and email are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: person.id,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          title: title.trim(),
          role,
          favoritePublixProduct: selectedProduct,
          favoriteDrinks: favoriteDrinks.trim(),
          favoriteSnacks: favoriteSnacks.trim(),
          dietaryRestrictions: dietaryRestrictions.trim(),
          energyBoost: coffeeOrder.trim(),
          allergies: allergies.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      toast("success", "Saved");
      setEditMode(false);
      onSaved?.();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!person) return null;

  return (
    <Modal open={true} onClose={onClose} title={editMode ? "Edit Team Member" : person.name} size="md">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="space-y-4">
        {/* Avatar + name + role header */}
        {editMode ? (
          <>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIconPickerOpen(!iconPickerOpen)}
                  className="group flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 transition-all hover:ring-2 hover:ring-primary/40"
                >
                  {selectedProduct && getProductIcon(selectedProduct) ? (
                    <img src={getProductIcon(selectedProduct)!} alt={selectedProduct} className="h-9 w-9 object-contain" />
                  ) : (
                    <span className="text-lg font-bold text-primary">
                      {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                    <Edit2 className="h-2.5 w-2.5" />
                  </div>
                </button>
              </div>
            </div>
            {iconPickerOpen && (
              <div className="rounded-xl border border-border bg-surface-primary p-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Choose Icon</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {PUBLIX_PRODUCTS.map((product) => (
                    <button
                      key={product.name}
                      type="button"
                      onClick={() => { setSelectedProduct(product.name); setIconPickerOpen(false); }}
                      className={`flex flex-col items-center gap-0.5 rounded-lg p-1.5 border text-center transition-all ${
                        selectedProduct === product.name
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-transparent hover:border-primary/40 hover:bg-surface-secondary"
                      }`}
                    >
                      <img src={product.icon} alt={product.name} className="h-6 w-6" />
                      <span className="text-[10px] font-medium text-text-secondary leading-tight truncate w-full">
                        {product.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555-123-4567" />
                <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Photographer, Art Director, etc." />
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-start gap-4">
            <UserAvatar name={person.name} favoriteProduct={person.favoritePublixProduct} size="xl" />
            <div className="flex-1 min-w-0 pt-0.5">
              {person.title && (
                <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-0.5">{person.title}</p>
              )}
              <div className="space-y-1.5 mt-2">
                <a href={`mailto:${person.email}`} className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                  {person.email}
                </a>
                {person.phone && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                    <span>{person.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Preferences */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
            <Coffee className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Preferences</span>
          </div>
          <div className="px-3.5 py-3 grid grid-cols-2 gap-x-6 gap-y-3">
            {/* Left col: Drinks, Snacks, Dietary */}
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1.5">Drinks</p>
                {editMode ? (
                  <input value={favoriteDrinks} onChange={(e) => setFavoriteDrinks(e.target.value)} placeholder="e.g. Sparkling water" className="w-full bg-transparent text-xs text-text-primary border-b border-dashed border-border p-0 outline-none focus:border-primary" />
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {person.favoriteDrinks ? person.favoriteDrinks.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                      <span key={item} className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary">{item}</span>
                    )) : <span className="text-xs text-text-tertiary">—</span>}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1.5">Snacks</p>
                {editMode ? (
                  <input value={favoriteSnacks} onChange={(e) => setFavoriteSnacks(e.target.value)} placeholder="e.g. Trail mix" className="w-full bg-transparent text-xs text-text-primary border-b border-dashed border-border p-0 outline-none focus:border-primary" />
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {person.favoriteSnacks ? person.favoriteSnacks.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                      <span key={item} className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary">{item}</span>
                    )) : <span className="text-xs text-text-tertiary">—</span>}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1.5">Dietary</p>
                {editMode ? (
                  <input value={dietaryRestrictions} onChange={(e) => setDietaryRestrictions(e.target.value)} placeholder="e.g. Gluten-free" className="w-full bg-transparent text-xs text-text-primary border-b border-dashed border-border p-0 outline-none focus:border-primary" />
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {person.dietaryRestrictions ? person.dietaryRestrictions.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                      <span key={item} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{item}</span>
                    )) : <span className="text-xs text-text-tertiary">—</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Right col: Coffee Order, Allergies */}
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1.5">Coffee Order</p>
                {editMode ? (
                  <input value={coffeeOrder} onChange={(e) => setCoffeeOrder(e.target.value)} placeholder="e.g. Oat milk latte" className="w-full bg-transparent text-xs text-text-primary border-b border-dashed border-border p-0 outline-none focus:border-primary" />
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {person.energyBoost ? person.energyBoost.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                      <span key={item} className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary">{item}</span>
                    )) : <span className="text-xs text-text-tertiary">—</span>}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1.5">Allergies</p>
                {editMode ? (
                  <input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. Peanuts, shellfish" className="w-full bg-transparent text-xs text-text-primary border-b border-dashed border-border p-0 outline-none focus:border-primary" />
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {person.allergies ? person.allergies.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                      <span key={item} className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">{item}</span>
                    )) : <span className="text-xs text-text-tertiary">—</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── What We Love ── */}
        {!editMode && person && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
              <Heart className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                What We Love About {person.name.split(" ")[0]}
              </span>
              {userNotes && userNotes.length > 0 && (
                <span className="text-[10px] text-text-tertiary ml-auto">{userNotes.length}</span>
              )}
            </div>
            <div className="px-3.5 py-3 space-y-3">
              <p className="text-[10px] italic text-text-tertiary">
                Share something kind — a great quality, a helpful moment, or something that makes this person awesome to work with.
              </p>
              {userNotes && userNotes.length > 0 ? (
                <div className="space-y-2.5 max-h-[180px] overflow-y-auto">
                  {userNotes.map((n) => (
                    <div key={n.id} className="group flex gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {n.authorName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-medium text-text-primary">{n.authorName}</span>
                          <span className="text-[10px] text-text-tertiary">
                            {formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5 break-words">{n.text}</p>
                      </div>
                      {currentUser && n.authorId === currentUser.id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(n.id)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:text-red-500 transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-tertiary">No notes yet — be the first!</p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                  placeholder="Say something nice..."
                  className="flex-1 h-8 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-40 hover:bg-primary-hover transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Growing Toward ── */}
        {!editMode && person && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
              <Compass className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                Growing Toward
              </span>
              {canEditGoal && !goalData?.goal && !goalEditMode && (
                <button
                  type="button"
                  onClick={() => { setGoalText(""); setGoalRoleContext(person.title || person.role); setGoalEditMode(true); }}
                  className="ml-auto text-[10px] text-primary hover:text-primary-hover transition-colors"
                >
                  + Set a goal
                </button>
              )}
              {canEditGoal && goalData?.goal && !goalEditMode && (
                <button
                  type="button"
                  onClick={() => { setGoalText(goalData.goal!.goalText); setGoalRoleContext(goalData.goal!.currentRoleContext); setGoalEditMode(true); }}
                  className="ml-auto flex items-center gap-1 text-[10px] text-text-tertiary hover:text-primary transition-colors"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
            <div className="px-3.5 py-3 space-y-3">
              {goalEditMode ? (
                /* Edit mode: set or update a goal */
                <div className="space-y-2.5">
                  <div>
                    <label className="text-[10px] font-medium text-text-secondary mb-1 block">What are you working toward?</label>
                    <input
                      type="text"
                      value={goalText}
                      onChange={(e) => setGoalText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveGoal(); } }}
                      placeholder="e.g., Becoming a Designer, learning post-production..."
                      className="w-full h-8 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-text-secondary mb-1 block">Current role (for framing advice)</label>
                    <input
                      type="text"
                      value={goalRoleContext}
                      onChange={(e) => setGoalRoleContext(e.target.value)}
                      placeholder="e.g., Production Assistant"
                      className="w-full h-8 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    {goalData?.goal && (
                      <button
                        type="button"
                        onClick={handleClearGoal}
                        disabled={savingGoal}
                        className="text-[10px] text-red-500 hover:text-red-600 transition-colors px-2 py-1"
                      >
                        Clear goal
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setGoalEditMode(false)}
                      className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveGoal}
                      disabled={!goalText.trim() || savingGoal}
                      className="text-[10px] font-medium text-primary hover:text-primary-hover disabled:opacity-40 transition-colors px-2 py-1"
                    >
                      {savingGoal ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : goalData?.goal ? (
                /* View mode — just the headline */
                <div className="space-y-1">
                  <p className="text-sm text-text-primary">{goalData.goal.goalText}</p>
                  {goalData.goal.currentRoleContext && (
                    <p className="text-[10px] text-text-tertiary">
                      Currently: {goalData.goal.currentRoleContext}
                    </p>
                  )}
                </div>
              ) : (
                /* No goal set */
                <p className="text-xs text-text-tertiary">
                  {isOwnProfile
                    ? "No goal set yet."
                    : "No goal set yet."}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Footer actions */}
        {editMode ? (
          <div className="flex gap-2 pt-2 border-t border-border justify-end">
            <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={handleSave}>Save Changes</Button>
          </div>
        ) : onSaved && (
          <div className="flex pt-2 border-t border-border">
            <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// --- External Vendors Section ---
function VendorSection({
  search,
  categoryFilter,
  viewMode,
  canEdit,
  showAdd,
  onOpenAdd,
  onCloseAdd,
}: {
  search: string;
  categoryFilter: string;
  viewMode: "grid" | "list";
  canEdit: boolean;
  showAdd: boolean;
  onOpenAdd: () => void;
  onCloseAdd: () => void;
}) {
  const { vendors, isLoading, mutate } = useVendors({ search: search || undefined });
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null);

  const filtered = categoryFilter
    ? vendors.filter((v) => v.category === categoryFilter)
    : vendors;

  return (
    <>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title={search || categoryFilter ? "No vendors match your filters" : "No vendors yet"}
          description={search || categoryFilter ? "Try adjusting your search or category filter." : "Add vendors to your approved roster."}
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((vendor) => (
            <Card key={vendor.id} hover padding="md" className="cursor-pointer" onClick={() => setDetailVendor(vendor)}>
              <div className="flex items-start gap-3">
                <UserAvatar name={vendor.contactName || vendor.companyName} favoriteProduct={vendor.favoritePublixProduct} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-semibold text-text-primary truncate">{vendor.companyName}</h3>
                  </div>
                  {(vendor.title || vendor.category) && (
                    <p className="text-xs text-text-secondary mb-1">{vendor.title || vendor.category}</p>
                  )}
                  <div className="space-y-0.5 text-xs text-text-tertiary">
                    {vendor.email && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail className="h-3 w-3 shrink-0" />
                        {vendor.email}
                      </p>
                    )}
                    {vendor.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0" />
                        {vendor.phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border-light space-y-2">
                {(vendor.favoriteDrinks || vendor.favoriteSnacks || vendor.dietaryRestrictions || vendor.allergies) ? (
                  <>
                    {vendor.favoriteDrinks && (
                      <div className="flex items-start gap-2">
                        <Coffee className="h-3 w-3 shrink-0 mt-1 text-text-tertiary" />
                        <div className="flex flex-wrap gap-1">
                          {vendor.favoriteDrinks.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                            <span key={item} className="rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] text-text-secondary">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {vendor.favoriteSnacks && (
                      <div className="flex items-start gap-2">
                        <Cookie className="h-3 w-3 shrink-0 mt-1 text-text-tertiary" />
                        <div className="flex flex-wrap gap-1">
                          {vendor.favoriteSnacks.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                            <span key={item} className="rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] text-text-secondary">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {vendor.dietaryRestrictions && (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-3 w-3 shrink-0 mt-1 text-amber-500" />
                        <div className="flex flex-wrap gap-1">
                          {vendor.dietaryRestrictions.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                            <span key={item} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {vendor.allergies && (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-3 w-3 shrink-0 mt-1 text-red-500" />
                        <div className="flex flex-wrap gap-1">
                          {vendor.allergies.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                            <span key={item} className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] text-red-700">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[10px] text-text-tertiary">No preferences set</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_120px_1fr_140px] gap-0 bg-surface-secondary border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            <div>Company</div>
            <div>Category</div>
            <div>Email</div>
            <div>Phone</div>
          </div>
          {filtered.map((vendor) => (
            <div
              key={vendor.id}
              className="grid grid-cols-1 sm:grid-cols-[1fr_120px_1fr_140px] gap-0 px-4 py-3 border-b border-border-light last:border-b-0 hover:bg-surface-secondary transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar name={vendor.contactName || vendor.companyName} size="xs" />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-text-primary truncate block">{vendor.companyName}</span>
                  {vendor.contactName && <span className="text-xs text-text-tertiary truncate block">{vendor.contactName}</span>}
                </div>
              </div>
              <div className="hidden sm:flex items-center">
                <span className="text-xs text-text-secondary">{vendor.category || "—"}</span>
              </div>
              <div className="hidden sm:flex items-center">
                <span className="text-xs text-text-secondary truncate">{vendor.email || "—"}</span>
              </div>
              <div className="hidden sm:flex items-center">
                <span className="text-xs text-text-secondary">{vendor.phone || "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddVendorModal
        open={showAdd}
        onClose={onCloseAdd}
        onCreated={() => { mutate(); onCloseAdd(); }}
      />

      {detailVendor && (
        <VendorDetailModal
          vendor={detailVendor}
          onClose={() => setDetailVendor(null)}
          onSaved={() => mutate()}
        />
      )}
    </>
  );
}

// --- Vendor Detail Modal ---
interface VendorNote {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

function VendorDetailModal({
  vendor,
  onClose,
  onSaved,
}: {
  vendor: Vendor;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const { user: currentUser } = useCurrentUser();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [vendorTitle, setVendorTitle] = useState(vendor.title || vendor.category || "");
  const [favoriteDrinks, setFavoriteDrinks] = useState(vendor.favoriteDrinks || "");
  const [favoriteSnacks, setFavoriteSnacks] = useState(vendor.favoriteSnacks || "");
  const [dietaryRestrictions, setDietaryRestrictions] = useState(vendor.dietaryRestrictions || "");
  const [allergies, setAllergies] = useState(vendor.allergies || "");
  const [coffeeOrder, setCoffeeOrder] = useState(vendor.energyBoost || "");

  // Praise notes
  const { data: vendorNotes, mutate: mutateNotes } = useSWR<VendorNote[]>(
    `/api/vendors/${vendor.id}/notes`,
    (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Request failed"); return r.json(); })
  );
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await fetch(`/api/vendors/${vendor.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newNote.trim() }),
      });
      setNewNote("");
      mutateNotes();
    } catch {
      toast("error", "Failed to add note");
    }
    setAddingNote(false);
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm("Delete this note?")) return;
    try {
      await fetch(`/api/vendors/${vendor.id}/notes/${noteId}`, { method: "DELETE" });
      mutateNotes();
    } catch {
      toast("error", "Failed to delete note");
    }
  }

  useEffect(() => {
    setVendorTitle(vendor.title || vendor.category || "");
    setFavoriteDrinks(vendor.favoriteDrinks || "");
    setFavoriteSnacks(vendor.favoriteSnacks || "");
    setDietaryRestrictions(vendor.dietaryRestrictions || "");
    setAllergies(vendor.allergies || "");
    setCoffeeOrder(vendor.energyBoost || "");
    setEditMode(false);
  }, [vendor]);

  function resetForm() {
    setVendorTitle(vendor.title || vendor.category || "");
    setFavoriteDrinks(vendor.favoriteDrinks || "");
    setFavoriteSnacks(vendor.favoriteSnacks || "");
    setDietaryRestrictions(vendor.dietaryRestrictions || "");
    setAllergies(vendor.allergies || "");
    setCoffeeOrder(vendor.energyBoost || "");
    setEditMode(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: vendorTitle,
          favoriteDrinks,
          favoriteSnacks,
          dietaryRestrictions,
          allergies,
          energyBoost: coffeeOrder,
        }),
      });
      toast("success", "Vendor updated");
      onSaved?.();
      setEditMode(false);
    } catch {
      toast("error", "Failed to save");
    }
    setSaving(false);
  }

  const displayTitle = vendor.title || vendor.category || "";

  return (
    <Modal open={true} onClose={onClose} title={editMode ? "Edit Vendor" : vendor.companyName} size="md">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-1">
          <UserAvatar name={vendor.contactName || vendor.companyName} favoriteProduct={vendor.favoritePublixProduct} size="xl" />
          {editMode ? (
            <input
              value={vendorTitle}
              onChange={(e) => setVendorTitle(e.target.value)}
              placeholder="Title (e.g. Photographer)"
              className="mt-1 w-full max-w-[200px] bg-transparent text-sm text-text-secondary text-center border-b border-dashed border-border p-0 outline-none focus:border-primary"
            />
          ) : displayTitle ? (
            <p className="text-sm text-text-secondary">{displayTitle}</p>
          ) : null}
          {vendor.contactName && (
            <p className="text-xs text-text-tertiary">{vendor.contactName}</p>
          )}
          {vendor.category && !editMode && (
            <Badge variant="default">{vendor.category}</Badge>
          )}
        </div>

        {/* Contact info */}
        <div className="space-y-1 text-sm text-text-secondary">
          {vendor.email && (
            <p className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-text-tertiary" />
              <a href={`mailto:${vendor.email}`} className="hover:underline">{vendor.email}</a>
            </p>
          )}
          {vendor.phone && (
            <p className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-text-tertiary" />
              {vendor.phone}
            </p>
          )}
        </div>

        {/* Preferences */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Preferences</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Coffee className="h-3.5 w-3.5 text-text-tertiary" />
                <p className="text-[10px] text-text-tertiary">Drinks</p>
              </div>
              {editMode ? (
                <input value={favoriteDrinks} onChange={(e) => setFavoriteDrinks(e.target.value)} placeholder="e.g. Iced coffee" className="w-full bg-transparent text-xs text-text-primary border-b border-dashed border-border p-0 outline-none focus:border-primary" />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {vendor.favoriteDrinks ? vendor.favoriteDrinks.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                    <span key={item} className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary">{item}</span>
                  )) : <span className="text-xs text-text-tertiary">—</span>}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Coffee className="h-3.5 w-3.5 text-text-tertiary" />
                <p className="text-[10px] text-text-tertiary">Coffee Order</p>
              </div>
              {editMode ? (
                <input value={coffeeOrder} onChange={(e) => setCoffeeOrder(e.target.value)} placeholder="e.g. Oat milk latte" className="w-full bg-transparent text-xs text-text-primary border-b border-dashed border-border p-0 outline-none focus:border-primary" />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {vendor.energyBoost ? vendor.energyBoost.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                    <span key={item} className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary">{item}</span>
                  )) : <span className="text-xs text-text-tertiary">—</span>}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Cookie className="h-3.5 w-3.5 text-text-tertiary" />
                <p className="text-[10px] text-text-tertiary">Snacks</p>
              </div>
              {editMode ? (
                <input value={favoriteSnacks} onChange={(e) => setFavoriteSnacks(e.target.value)} placeholder="e.g. Trail mix" className="w-full bg-transparent text-xs text-text-primary border-b border-dashed border-border p-0 outline-none focus:border-primary" />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {vendor.favoriteSnacks ? vendor.favoriteSnacks.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                    <span key={item} className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary">{item}</span>
                  )) : <span className="text-xs text-text-tertiary">—</span>}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                <p className="text-[10px] text-text-tertiary">Allergies</p>
              </div>
              {editMode ? (
                <input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. Peanuts" className="w-full bg-transparent text-xs text-text-primary border-b border-dashed border-border p-0 outline-none focus:border-primary" />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {vendor.allergies ? vendor.allergies.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                    <span key={item} className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">{item}</span>
                  )) : <span className="text-xs text-text-tertiary">—</span>}
                </div>
              )}
            </div>
          </div>
          {editMode && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-[10px] text-text-tertiary">Dietary Restrictions</p>
              </div>
              <input value={dietaryRestrictions} onChange={(e) => setDietaryRestrictions(e.target.value)} placeholder="e.g. Vegan, Gluten-free" className="w-full bg-transparent text-xs text-text-primary border-b border-dashed border-border p-0 outline-none focus:border-primary" />
            </div>
          )}
          {!editMode && vendor.dietaryRestrictions && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-[10px] text-text-tertiary">Dietary</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {vendor.dietaryRestrictions.split(",").map((s) => s.trim()).filter(Boolean).map((item) => (
                  <span key={item} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{item}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* What We Love */}
        {!editMode && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
              <Heart className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                What We Love About {vendor.contactName?.split(" ")[0] || vendor.companyName}
              </span>
              {vendorNotes && vendorNotes.length > 0 && (
                <span className="text-[10px] text-text-tertiary ml-auto">{vendorNotes.length}</span>
              )}
            </div>
            <div className="px-3.5 py-3 space-y-3">
              <p className="text-[10px] italic text-text-tertiary">
                Share something kind — a great quality, a helpful moment, or something that makes working with them awesome.
              </p>
              {vendorNotes && vendorNotes.length > 0 ? (
                <div className="space-y-2.5 max-h-[180px] overflow-y-auto">
                  {vendorNotes.map((n) => (
                    <div key={n.id} className="group flex gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {n.authorName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-medium text-text-primary">{n.authorName}</span>
                          <span className="text-[10px] text-text-tertiary">
                            {formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5 break-words">{n.text}</p>
                      </div>
                      {currentUser && n.authorId === currentUser.id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(n.id)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:text-red-500 transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-tertiary">No notes yet — be the first!</p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                  placeholder="Say something nice..."
                  className="flex-1 h-8 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-40 hover:bg-primary-hover transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {editMode ? (
          <div className="flex gap-2 pt-2 border-t border-border justify-end">
            <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={handleSave}>Save Changes</Button>
          </div>
        ) : onSaved && (
          <div className="flex pt-2 border-t border-border">
            <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// --- Add Team Member Modal ---
function AddTeamMemberModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("Studio");
  const [favoriteDrinks, setFavoriteDrinks] = useState("");
  const [favoriteSnacks, setFavoriteSnacks] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");

  function reset() {
    setName(""); setEmail(""); setPhone(""); setTitle(""); setRole("Studio");
    setFavoriteDrinks(""); setFavoriteSnacks(""); setDietaryRestrictions("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast("error", "Name and email are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          title: title.trim(),
          role,
          favoriteDrinks: favoriteDrinks.trim(),
          favoriteSnacks: favoriteSnacks.trim(),
          dietaryRestrictions: dietaryRestrictions.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      toast("success", "Team member added");
      reset();
      onCreated();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to add team member");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Team Member" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555-123-4567" />
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Photographer, Art Director, etc." />
        </div>
        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as "Producer" | "Studio" | "Admin")}
          options={[
            { value: "Producer", label: "Producer" },
            { value: "Studio", label: "Studio" },
            { value: "Admin", label: "Admin / HOP" },
          ]}
        />
        <div className="border-t border-border pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Preferences</p>
          <div className="space-y-3">
            <Input label="Favorite Drinks" value={favoriteDrinks} onChange={(e) => setFavoriteDrinks(e.target.value)} placeholder="e.g. Oat milk latte, sparkling water" />
            <Input label="Favorite Snacks" value={favoriteSnacks} onChange={(e) => setFavoriteSnacks(e.target.value)} placeholder="e.g. Trail mix, dark chocolate" />
            <Input label="Dietary Restrictions" value={dietaryRestrictions} onChange={(e) => setDietaryRestrictions(e.target.value)} placeholder="e.g. Gluten-free, vegan, nut allergy" />
          </div>
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Add Team Member</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// --- Add Vendor Modal ---
function AddVendorModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setCompanyName(""); setContactName(""); setEmail(""); setPhone(""); setCategory(""); setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      toast("error", "Company name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          contactName: contactName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          category,
          notes: notes.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to create vendor");
      toast("success", "Vendor added to roster");
      reset();
      onCreated();
    } catch {
      toast("error", "Failed to create vendor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Vendor" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Company Name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          <Input label="Contact Name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Select category..."
          options={VENDOR_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Add Vendor</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
