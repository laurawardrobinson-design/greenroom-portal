"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PackageSearch, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { useCampaigns } from "@/hooks/use-campaigns";

export default function NewProductRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCampaignId = searchParams.get("campaign") ?? "";

  const { campaigns, isLoading } = useCampaigns();

  const [campaignId, setCampaignId] = useState(preselectedCampaignId);
  const [shootDate, setShootDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedCampaign = campaigns.find((c) => c.id === campaignId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || !shootDate) {
      setError("Please select a campaign and shoot date.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/product-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, shootDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        return;
      }
      const doc = await res.json();
      router.push(`/product-requests/${doc.id}`);
    } catch {
      setError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Product Requests
      </button>

      <PageHeader title="New Product Request" />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Campaign picker */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-text-primary">Campaign</label>
          {isLoading ? (
            <div className="h-10 rounded-lg bg-surface-secondary animate-pulse" />
          ) : (
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              required
              className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
            >
              <option value="">Select a campaign…</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.wfNumber, c.name].filter(Boolean).join(" ")}
                </option>
              ))}
            </select>
          )}
          {selectedCampaign && (
            <p className="text-[11px] text-text-tertiary">{selectedCampaign.status}</p>
          )}
        </div>

        {/* Shoot date */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-text-primary">Shoot Date</label>
          <input
            type="date"
            value={shootDate}
            onChange={(e) => setShootDate(e.target.value)}
            required
            className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
          />
          <p className="text-[11px] text-text-tertiary">
            Products from the campaign shot list will be pre-filled by department.
          </p>
        </div>

        {error && (
          <p className="text-sm text-error">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !campaignId || !shootDate}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <PackageSearch className="h-4 w-4" />
            {submitting ? "Creating…" : "Create Request"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
