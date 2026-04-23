"use client";

import { useState } from "react";
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
import { VENDOR_CATEGORIES } from "@/lib/constants/categories";
import { Plus, Users, Search, Mail, Phone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export default function VendorsPage() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const { vendors, isLoading, mutate } = useVendors({
    search: search || undefined,
  });
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Vendor Roster"
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add Vendor
          </Button>
        }
      />

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
            placeholder="Search vendors..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (e.target.value === "") setSearch("");
            }}
            className="h-7 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary shadow-xs focus:border-primary focus:outline-none sm:w-80"
          />
        </div>
      </form>

      {/* Vendor list */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={search ? "No vendors match your search" : "No vendors yet"}
          description={
            search
              ? "Try a different search term."
              : "Add vendors to your approved roster."
          }
          action={
            !search ? (
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
            <Card key={vendor.id} padding="md" className="h-full">
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

      {/* Add Vendor Modal */}
      <AddVendorModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          mutate();
          setShowAdd(false);
        }}
      />
    </div>
  );
}

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
          <Input
            label="Company Name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
          <Input
            label="Contact Name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <Select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Select category..."
          options={VENDOR_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Add Vendor
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
