"use client";

import { useState } from "react";
import useSWR from "swr";
import type { AppUser } from "@/types/domain";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import {
  Settings,
  Shield,
  User,
  Users,
  Mail,
  Phone,
  Contact,
  AlertTriangle,
  Utensils,
  Zap,
  Pencil,
  Check,
  X,
} from "lucide-react";
import {
  PUBLIX_PRODUCTS,
  CONTACT_OPTIONS,
  SNACK_PRESETS,
  DRINK_PRESETS,
  ENERGY_PRESETS,
  TagInput,
  getProductIcon,
} from "@/components/onboarding/onboarding-modal";
import { RateCardManagement } from "@/components/settings/rate-card-management";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Request failed"); return r.json(); });

const ROLE_COLORS: Record<string, string> = {
  Admin: "bg-purple-50 text-purple-700",
  Producer: "bg-blue-50 text-blue-700",
  Studio: "bg-teal-50 text-teal-700",
  Vendor: "bg-amber-50 text-amber-700",
};

const ALL_ROLES = ["Admin", "Producer", "Post Producer", "Studio", "Art Director", "Designer", "Vendor"];

// -------------------------------------------------------
// Preset chips (local) — toggling for snacks/drinks
// -------------------------------------------------------
function PresetChips({
  presets,
  activeTags,
  onToggle,
}: {
  presets: string[];
  activeTags: string[];
  onToggle: (preset: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((preset) => {
        const active = activeTags.includes(preset);
        return (
          <button
            key={preset}
            type="button"
            onClick={() => onToggle(preset)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
              active
                ? "bg-primary text-white border-primary"
                : "bg-surface border-border text-text-secondary hover:border-primary/40 hover:text-text-primary"
            }`}
          >
            {preset}
          </button>
        );
      })}
    </div>
  );
}

function ProductRowItem({ productName }: { productName: string }) {
  const iconSrc = getProductIcon(productName);
  return (
    <div className="flex items-center gap-1.5 text-sm text-text-secondary">
      {iconSrc && <img src={iconSrc} alt={productName} className="h-4 w-4 shrink-0" />}
      <span>{productName}</span>
    </div>
  );
}

// -------------------------------------------------------
// My Card — contact card preview
// -------------------------------------------------------
function MyCard({ user }: { user: AppUser }) {
  const productIconSrc = getProductIcon(user.favoritePublixProduct);
  const snacks = user.favoriteSnacks ? user.favoriteSnacks.split(", ").filter(Boolean) : [];
  const drinks = user.favoriteDrinks ? user.favoriteDrinks.split(", ").filter(Boolean) : [];
  const allergies = user.allergies ? user.allergies.split(", ").filter(Boolean) : [];

  const contactIcon = CONTACT_OPTIONS.find((c) => c.value === user.preferredContact);
  const ContactIcon = contactIcon?.icon ?? Mail;

  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-4 space-y-3">
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <UserAvatar name={user.name} favoriteProduct={user.favoritePublixProduct} size="lg" />
        <div>
          <p className="font-semibold text-text-primary">{user.name}</p>
          <p className="text-xs text-text-tertiary">
            {user.role}{user.title ? ` · ${user.title}` : ""}
          </p>
        </div>
      </div>

      {/* Contact info */}
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2 text-text-secondary">
          <Mail className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
          <span>{user.email}</span>
        </div>
        {user.phone && (
          <div className="flex items-center gap-2 text-text-secondary">
            <Phone className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
            <span>{user.phone}</span>
          </div>
        )}
        {user.preferredContact && (
          <div className="flex items-center gap-2 text-text-secondary">
            <ContactIcon className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
            <span>Prefers {user.preferredContact}</span>
          </div>
        )}
      </div>

      {/* Preferences */}
      <div className="border-t border-border pt-3 space-y-1.5 text-sm">
        {snacks.length > 0 && (
          <div className="flex items-start gap-2 text-text-secondary">
            <span className="shrink-0 mt-0.5">🍿</span>
            <span>{snacks.join(", ")}</span>
          </div>
        )}
        {drinks.length > 0 && (
          <div className="flex items-start gap-2 text-text-secondary">
            <span className="shrink-0 mt-0.5">🥤</span>
            <span>{drinks.join(", ")}</span>
          </div>
        )}
        {user.energyBoost && (
          <div className="flex items-start gap-2 text-text-secondary">
            <Zap className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <span>{user.energyBoost}</span>
          </div>
        )}
        {allergies.length > 0 && (
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {allergies.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        {user.dietaryRestrictions && (
          <div className="flex items-start gap-2 text-text-secondary">
            <Utensils className="h-3.5 w-3.5 text-text-tertiary shrink-0 mt-0.5" />
            <span>{user.dietaryRestrictions}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Preferences form
// -------------------------------------------------------
function PreferencesForm({
  user,
  onSaved,
}: {
  user: AppUser;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState(user.favoritePublixProduct || "");
  const [snackTags, setSnackTags] = useState<string[]>(
    user.favoriteSnacks ? user.favoriteSnacks.split(", ").filter(Boolean) : []
  );
  const [drinkTags, setDrinkTags] = useState<string[]>(
    user.favoriteDrinks ? user.favoriteDrinks.split(", ").filter(Boolean) : []
  );
  const [energyBoost, setEnergyBoost] = useState(user.energyBoost || "");
  const [allergyTags, setAllergyTags] = useState<string[]>(
    user.allergies ? user.allergies.split(", ").filter(Boolean) : []
  );
  const [dietaryRestrictions, setDietaryRestrictions] = useState(
    user.dietaryRestrictions || ""
  );
  const [preferredContact, setPreferredContact] = useState(user.preferredContact || "Email");
  const [phone, setPhone] = useState(user.phone || "");

  function toggleTag(tags: string[], setTags: (t: string[]) => void, value: string) {
    if (tags.includes(value)) {
      setTags(tags.filter((t) => t !== value));
    } else {
      setTags([...tags, value]);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          favoritePublixProduct: selectedProduct,
          favoriteSnacks: snackTags.join(", "),
          favoriteDrinks: drinkTags.join(", "),
          energyBoost,
          allergies: allergyTags.join(", "),
          dietaryRestrictions,
          preferredContact,
          phone,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Preferences saved");
      onSaved();
    } catch {
      toast("error", "Couldn't save — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Publix icon */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Your Publix icon</p>
        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto overscroll-contain pr-1">
          {PUBLIX_PRODUCTS.map((product) => (
            <button
              key={product.name}
              onClick={() => setSelectedProduct(product.name)}
              className={`flex flex-col items-center gap-1 rounded-xl p-2 border text-center transition-all ${
                selectedProduct === product.name
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/40 hover:bg-surface-secondary"
              }`}
            >
              <img src={product.icon} alt={product.name} className="h-6 w-6" />
              <span className="text-[10px] font-medium text-text-secondary leading-tight">
                {product.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Snacks */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">🍿 Snacks</p>
        <PresetChips
          presets={SNACK_PRESETS}
          activeTags={snackTags}
          onToggle={(p) => toggleTag(snackTags, setSnackTags, p)}
        />
        <div className="mt-2">
          <TagInput
            tags={snackTags}
            onChange={setSnackTags}
            placeholder="Add your favorite..."
          />
        </div>
      </div>

      {/* Drinks */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">🥤 Drinks</p>
        <PresetChips
          presets={DRINK_PRESETS}
          activeTags={drinkTags}
          onToggle={(p) => toggleTag(drinkTags, setDrinkTags, p)}
        />
        <div className="mt-2">
          <TagInput
            tags={drinkTags}
            onChange={setDrinkTags}
            placeholder="Add your favorite..."
          />
        </div>
      </div>

      {/* Energy boost */}
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-text-primary mb-1">
          <Zap className="h-4 w-4 text-primary" />
          Energy Boost
        </p>
        <p className="text-xs text-text-tertiary mb-2">
          Give us your full order — the more specific, the better.
        </p>
        <div className="mb-2">
          <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">
            Quick start →
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ENERGY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setEnergyBoost(preset + " - ");
                  setTimeout(() => {
                    const el = document.querySelector<HTMLInputElement>("[data-energy-input-settings]");
                    el?.focus();
                    if (el) {
                      const len = el.value.length;
                      el.setSelectionRange(len, len);
                    }
                  }, 0);
                }}
                className="rounded-full px-3 py-1 text-xs font-medium border border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary transition-all"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <input
          data-energy-input-settings
          type="text"
          value={energyBoost}
          onChange={(e) => setEnergyBoost(e.target.value)}
          placeholder="e.g. Iced coffee - 2 pumps sugar free vanilla, oat milk"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Allergies */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-1.5">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Allergies
        </label>
        <TagInput
          tags={allergyTags}
          onChange={setAllergyTags}
          placeholder="Type an allergy and press Enter..."
        />
      </div>

      {/* Dietary */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-1.5">
          <Utensils className="h-4 w-4 text-primary" />
          Dietary preferences
        </label>
        <input
          type="text"
          value={dietaryRestrictions}
          onChange={(e) => setDietaryRestrictions(e.target.value)}
          placeholder="e.g. Vegetarian, Gluten-Free"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Contact */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
          <Contact className="h-4 w-4 text-primary" />
          Best way to reach you
        </label>
        <div className="grid grid-cols-3 gap-2">
          {CONTACT_OPTIONS.map(({ value, label, icon: Icon, description }) => (
            <button
              key={value}
              onClick={() => setPreferredContact(value)}
              className={`flex flex-col items-center gap-2 rounded-xl p-3 border text-center transition-all ${
                preferredContact === value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/40 hover:bg-surface-secondary"
              }`}
            >
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  preferredContact === value ? "bg-primary text-white" : "bg-surface-secondary text-text-tertiary"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-text-primary">{label}</p>
                <p className="text-[10px] text-text-tertiary leading-tight">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Phone */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-1.5">
          <Phone className="h-4 w-4 text-primary" />
          Cell phone
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 000-0000"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Button
          size="sm"
          loading={saving}
          onClick={handleSave}
          className="flex-1"
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Save preferences
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Main page
// -------------------------------------------------------
export default function SettingsPage() {
  const { user, isLoading: loadingUser, mutate } = useCurrentUser();
  const isAdmin = user?.role === "Admin";
  const [editingPrefs, setEditingPrefs] = useState(false);

  const { data: users, isLoading: loadingUsers, mutate: mutateUsers } = useSWR<AppUser[]>(
    isAdmin ? "/api/users?roles=Admin,Producer,Studio,Vendor" : null,
    fetcher
  );

  if (loadingUser) return <DashboardSkeleton />;

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-text-primary">Settings</h2>

      {/* My Card */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Contact className="h-4 w-4" />
              My Card
            </CardTitle>
            {!editingPrefs && (
              <button
                onClick={() => setEditingPrefs(true)}
                className="ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit preferences
              </button>
            )}
            {editingPrefs && (
              <button
                onClick={() => setEditingPrefs(false)}
                className="ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            )}
          </CardHeader>
          {editingPrefs ? (
            <PreferencesForm
              user={user}
              onSaved={() => {
                mutate();
                setEditingPrefs(false);
              }}
            />
          ) : (
            <MyCard user={user} />
          )}
        </Card>
      )}


      {/* User management (Admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Shield className="h-4 w-4" />
              User Management
            </CardTitle>
          </CardHeader>
          {loadingUsers ? (
            <DashboardSkeleton />
          ) : users && users.length > 0 ? (
            <div className="space-y-1">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                <div className="col-span-4">User</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  appUser={u}
                  isCurrentUser={u.id === user?.id}
                  onUpdated={mutateUsers}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-text-tertiary">
              <Users className="h-4 w-4" />
              No users found
            </div>
          )}
        </Card>
      )}

      {/* Rate Card Management (Admin only) */}
      {isAdmin && <RateCardManagement />}
    </div>
  );
}

// -------------------------------------------------------
// User row (admin user management)
// -------------------------------------------------------
function UserRow({
  appUser,
  isCurrentUser,
  onUpdated,
}: {
  appUser: AppUser;
  isCurrentUser: boolean;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  async function handleRoleChange(newRole: string) {
    setUpdating(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appUser.id, role: newRole }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", `${appUser.name} is now ${newRole}`);
      onUpdated();
    } catch {
      toast("error", "Failed to update role");
    } finally {
      setUpdating(false);
    }
  }

  async function handleToggleActive() {
    setUpdating(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appUser.id, active: !appUser.active }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", `${appUser.name} ${appUser.active ? "deactivated" : "activated"}`);
      onUpdated();
    } catch {
      toast("error", "Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      className={`grid grid-cols-12 items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
        isCurrentUser ? "bg-primary/5" : "hover:bg-surface-secondary"
      }`}
    >
      <div className="col-span-4">
        <p className="text-sm font-medium text-text-primary truncate">
          {appUser.name}
          {isCurrentUser && (
            <span className="ml-1.5 text-[10px] text-text-tertiary">(you)</span>
          )}
        </p>
        {appUser.title && (
          <p className="text-xs text-text-tertiary truncate">{appUser.title}</p>
        )}
      </div>
      <div className="col-span-3">
        <p className="text-xs text-text-secondary truncate">{appUser.email}</p>
      </div>
      <div className="col-span-2">
        <select
          value={appUser.role}
          onChange={(e) => handleRoleChange(e.target.value)}
          disabled={updating || isCurrentUser}
          className="h-7 w-full rounded border border-border bg-surface px-1.5 text-xs font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="col-span-1">
        <Badge
          variant="custom"
          className={
            appUser.active
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-600"
          }
        >
          {appUser.active ? "Active" : "Inactive"}
        </Badge>
      </div>
      <div className="col-span-2 text-right">
        {!isCurrentUser && (
          <Button
            size="sm"
            variant="ghost"
            loading={updating}
            onClick={handleToggleActive}
            className="text-xs"
          >
            {appUser.active ? "Deactivate" : "Activate"}
          </Button>
        )}
      </div>
    </div>
  );
}
