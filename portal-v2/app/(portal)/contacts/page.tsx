"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import type { AppUser, Vendor } from "@/types/domain";
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
} from "lucide-react";

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
  const canEdit = user?.role === "Admin" || user?.role === "Producer";

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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["team", "vendors"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
            }`}
          >
            {t === "team" ? "Internal Team" : "External Vendors"}
          </button>
        ))}
      </div>

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
    { revalidateOnMount: true, dedupingInterval: 0 }
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
              {(person.favoriteDrinks || person.favoriteSnacks || person.dietaryRestrictions || person.allergies) && (
                <div className="mt-3 pt-3 border-t border-border-light space-y-2">
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
                </div>
              )}
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
              onClick={() => setDetailPerson(person)}
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
        {/* Avatar + role */}
        <div className="flex items-center gap-3">
          {editMode ? (
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
          ) : (
            <UserAvatar name={person.name} favoriteProduct={person.favoritePublixProduct} size="xl" />
          )}
          <div>
            {(editMode ? title : person.title) && (
              <p className="text-sm text-text-secondary">{editMode ? title : person.title}</p>
            )}
          </div>
        </div>

        {/* Icon picker — rendered inline so it doesn't fight the modal's overflow-y-auto */}
        {editMode && iconPickerOpen && (
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

        {/* Contact info */}
        {editMode ? (
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
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Mail className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
              <a href={`mailto:${person.email}`} className="hover:underline">{person.email}</a>
            </div>
            {person.phone && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Phone className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                <span>{person.phone}</span>
              </div>
            )}
          </div>
        )}

        {/* Preferences — 2-col layout */}
        <div className="pt-3 border-t border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Preferences</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {/* Left col: Drinks, Snacks, Dietary */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Coffee className="h-3.5 w-3.5 text-text-tertiary" />
                  <p className="text-[10px] text-text-tertiary">Drinks</p>
                </div>
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
                <div className="flex items-center gap-1.5 mb-1">
                  <Cookie className="h-3.5 w-3.5 text-text-tertiary" />
                  <p className="text-[10px] text-text-tertiary">Snacks</p>
                </div>
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
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <p className="text-[10px] text-text-tertiary">Dietary</p>
                </div>
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
                <div className="flex items-center gap-1.5 mb-1">
                  <Coffee className="h-3.5 w-3.5 text-text-tertiary" />
                  <p className="text-[10px] text-text-tertiary">Coffee Order</p>
                </div>
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
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  <p className="text-[10px] text-text-tertiary">Allergies</p>
                </div>
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
            <Card key={vendor.id} hover padding="md">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-text-primary">{vendor.companyName}</h3>
                {vendor.category && (
                  <Badge variant="default">{vendor.category}</Badge>
                )}
              </div>
              {vendor.contactName && (
                <p className="text-sm text-text-secondary mb-2">{vendor.contactName}</p>
              )}
              <div className="space-y-1 text-xs text-text-tertiary">
                {vendor.email && (
                  <p className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    {vendor.email}
                  </p>
                )}
                {vendor.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    {vendor.phone}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_160px_1fr_140px] gap-0 bg-surface-secondary border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            <div>Company</div>
            <div>Category</div>
            <div>Contact</div>
            <div>Phone</div>
          </div>
          {filtered.map((vendor) => (
            <div
              key={vendor.id}
              className="grid grid-cols-1 sm:grid-cols-[1fr_160px_1fr_140px] gap-0 px-4 py-3 border-b border-border-light last:border-b-0 hover:bg-surface-secondary transition-colors"
            >
              <div className="flex items-center min-w-0">
                <span className="text-sm font-medium text-text-primary truncate">{vendor.companyName}</span>
              </div>
              <div className="hidden sm:flex items-center">
                <span className="text-xs text-text-secondary">{vendor.category || "—"}</span>
              </div>
              <div className="hidden sm:flex items-center">
                <div className="min-w-0">
                  {vendor.contactName && (
                    <span className="text-xs text-text-secondary truncate block">{vendor.contactName}</span>
                  )}
                  {vendor.email && (
                    <span className="text-xs text-text-tertiary truncate block">{vendor.email}</span>
                  )}
                </div>
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
    </>
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
