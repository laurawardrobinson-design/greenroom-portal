"use client";

import { useState } from "react";
import useSWR from "swr";
import type { AppUser, Vendor } from "@/types/domain";
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
import { VENDOR_CATEGORIES } from "@/lib/constants/categories";
import {
  Plus,
  Search,
  Mail,
  Phone,
  Users,
  Building2,
  UserCircle,
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

export default function ContactsPage() {
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("team");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const canEdit = user?.role === "Admin" || user?.role === "Producer";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Contacts</h2>
          <p className="text-sm text-text-secondary">
            Internal team and external vendors for call sheets
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => { setTab("team"); setSearch(""); setSearchInput(""); }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "team"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
          }`}
        >
          <Users className="h-4 w-4" />
          Internal Team
        </button>
        <button
          onClick={() => { setTab("vendors"); setSearch(""); setSearchInput(""); }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "vendors"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
          }`}
        >
          <Building2 className="h-4 w-4" />
          External Vendors
        </button>
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput);
        }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder={tab === "team" ? "Search team members..." : "Search vendors..."}
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (e.target.value === "") setSearch("");
            }}
            className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary shadow-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none sm:w-80"
          />
        </div>
      </form>

      {tab === "team" ? (
        <TeamSection search={search} canEdit={canEdit} />
      ) : (
        <VendorSection search={search} canEdit={canEdit} />
      )}
    </div>
  );
}

// --- Internal Team Section ---
function TeamSection({ search, canEdit }: { search: string; canEdit: boolean }) {
  const { data: rawAllUsers, isLoading, mutate } = useSWR<AppUser[]>(
    "/api/users?roles=Admin,Producer,Studio",
    fetcher
  );
  const allUsers: AppUser[] = Array.isArray(rawAllUsers) ? rawAllUsers : [];
  const [showAdd, setShowAdd] = useState(false);

  const filtered = search
    ? allUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          u.title?.toLowerCase().includes(search.toLowerCase())
      )
    : allUsers;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {filtered.length} team member{filtered.length !== 1 ? "s" : ""}
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Team Member
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={search ? "No matches" : "No team members yet"}
          description={search ? "Try a different search." : "Add your internal team members."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((person) => (
            <Card key={person.id} hover padding="md">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-tertiary text-sm font-semibold text-text-secondary">
                  {person.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {person.name}
                    </h3>
                    <Badge
                      variant="custom"
                      className={ROLE_BADGE[person.role] || "bg-slate-50 text-slate-600"}
                    >
                      {person.role}
                    </Badge>
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
            </Card>
          ))}
        </div>
      )}

      <AddTeamMemberModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => { mutate(); setShowAdd(false); }}
      />
    </>
  );
}

// --- External Vendors Section ---
function VendorSection({ search, canEdit }: { search: string; canEdit: boolean }) {
  const { vendors, isLoading, mutate } = useVendors({ search: search || undefined });
  const [showAdd, setShowAdd] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Vendor
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title={search ? "No vendors match your search" : "No vendors yet"}
          description={search ? "Try a different search term." : "Add vendors to your approved roster."}
          action={
            canEdit && !search ? (
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add Vendor
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => (
            <Card key={vendor.id} hover padding="md">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-text-primary">
                  {vendor.companyName}
                </h3>
                {vendor.category && (
                  <Badge variant="default">{vendor.category}</Badge>
                )}
              </div>
              {vendor.contactName && (
                <p className="text-sm text-text-secondary mb-2">
                  {vendor.contactName}
                </p>
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
      )}

      <AddVendorModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => { mutate(); setShowAdd(false); }}
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

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setTitle("");
    setRole("Studio");
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
          onChange={(e) => setRole(e.target.value)}
          options={[
            { value: "Producer", label: "Producer" },
            { value: "Studio", label: "Studio" },
            { value: "Admin", label: "Admin / HOP" },
          ]}
        />
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
    setCompanyName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setCategory("");
    setNotes("");
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
