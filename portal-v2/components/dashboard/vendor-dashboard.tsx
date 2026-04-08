"use client";

import useSWR from "swr";
import type { AppUser, Campaign, CampaignVendor } from "@/types/domain";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { HighlightsCard } from "@/components/dashboard/highlights-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { formatCurrency } from "@/lib/utils/format";
import { VENDOR_STATUS_COLORS } from "@/lib/constants/statuses";
import { Briefcase, FileText, PenLine, Upload, Clock, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  user: AppUser;
}

function getCampaignDisplayName(
  assignment: CampaignVendor,
  campaignMap: Map<string, Campaign>
): string {
  const mappedCampaign = campaignMap.get(assignment.campaignId);
  if (mappedCampaign?.name) return mappedCampaign.name;
  if (assignment.campaignName) return assignment.campaignName;
  if (assignment.campaignWfNumber) return assignment.campaignWfNumber;
  return "Campaign";
}

/** What the vendor needs to do next for each status */
const NEXT_ACTION: Record<string, { label: string; icon: React.ElementType; urgent: boolean } | null> = {
  Invited: { label: "Submit Estimate", icon: FileText, urgent: true },
  "Estimate Revision Requested": { label: "Revise Estimate", icon: FileText, urgent: true },
  "Estimate Submitted": null, // waiting on Producer
  "Estimate Approved": null, // waiting on PO upload
  "PO Uploaded": { label: "Sign PO", icon: PenLine, urgent: true },
  "PO Signed": null, // waiting for shoot
  "Shoot Complete": { label: "Upload Invoice", icon: Upload, urgent: true },
  "Invoice Submitted": null, // waiting on approval
  "Invoice Pre-Approved": null, // waiting on HOP
  "Invoice Approved": null, // waiting on payment
  Paid: null,
};

/** Human-readable waiting message per status */
const WAITING_MESSAGE: Record<string, string> = {
  "Estimate Revision Requested": "Producer requested estimate revisions",
  "Estimate Submitted": "Waiting for estimate review",
  "Estimate Approved": "Waiting for PO document",
  "PO Signed": "Waiting for shoot day",
  "Invoice Submitted": "Invoice under review",
  "Invoice Pre-Approved": "Invoice awaiting final approval",
  "Invoice Approved": "Awaiting payment",
  Paid: "Complete",
};

export function VendorDashboard({ user }: Props) {
  const { data: stats } = useSWR("/api/dashboard", fetcher);
  const { data: campaigns, isLoading: loadingCampaigns } = useSWR<Campaign[]>(
    "/api/campaigns",
    fetcher
  );
  const { data: rawAssignments, isLoading: loadingAssignments } = useSWR<CampaignVendor[]>(
    user.vendorId ? `/api/campaign-vendors?vendorId=${user.vendorId}` : null,
    fetcher
  );
  const assignments = Array.isArray(rawAssignments) ? rawAssignments : [];
  const isLoading = loadingCampaigns || loadingAssignments;

  // Build a map of campaignId → campaign for lookup
  const campaignMap = new Map<string, Campaign>();
  if (campaigns) {
    for (const c of campaigns) {
      campaignMap.set(c.id, c);
    }
  }

  // Separate active vs. completed
  const active = assignments.filter((a) => a.status !== "Paid" && a.status !== "Rejected");
  const completed = assignments.filter((a) => a.status === "Paid");
  const needsAction = active.filter((a) => NEXT_ACTION[a.status]?.urgent);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          Welcome back, {user.name.split(" ")[0]}
        </h2>
        <p className="text-sm text-text-secondary">
          Your campaign assignments and tasks
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
      <div className="lg:col-span-7 space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Briefcase className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary">Active Assignments</p>
              <p className="text-xl font-semibold text-text-primary">
                {stats?.activeAssignments ?? "—"}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary">Action Needed</p>
              <p className="text-xl font-semibold text-text-primary">
                {isLoading ? "—" : needsAction.length}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary">Completed</p>
              <p className="text-xl font-semibold text-text-primary">
                {isLoading ? "—" : completed.length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Action needed section */}
      {needsAction.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Action Needed</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {needsAction.map((a) => {
              const action = NEXT_ACTION[a.status];
              if (!action) return null;
              const Icon = action.icon;
              return (
                <Link
                  key={a.id}
                  href={`/vendor-workflow?assignment=${a.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-surface-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {getCampaignDisplayName(a, campaignMap)}
                      </p>
                      <p className="text-xs text-text-tertiary">{action.label}</p>
                    </div>
                  </div>
                  <Badge variant="custom" className={VENDOR_STATUS_COLORS[a.status]}>
                    {a.status}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {/* All assignments */}
      <Card>
        <CardHeader>
          <CardTitle>My Assignments</CardTitle>
        </CardHeader>
        {isLoading ? (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : active.length === 0 && completed.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-5 w-5" />}
            title="No active assignments"
            description="Campaigns you've been invited to will appear here. Each assignment has its own estimate, PO, and invoice workflow."
          />
        ) : (
          <div className="space-y-2">
            {active.map((a) => {
              const action = NEXT_ACTION[a.status];
              const waiting = WAITING_MESSAGE[a.status];
              return (
                <Link
                  key={a.id}
                  href={`/vendor-workflow?assignment=${a.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-surface-secondary transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {getCampaignDisplayName(a, campaignMap)}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {action ? action.label : waiting || a.status}
                    </p>
                    {a.estimateTotal > 0 && (
                      <p className="text-xs text-text-tertiary mt-0.5">
                        Estimate: {formatCurrency(a.estimateTotal)}
                      </p>
                    )}
                  </div>
                  <Badge variant="custom" className={VENDOR_STATUS_COLORS[a.status]}>
                    {a.status}
                  </Badge>
                </Link>
              );
            })}
            {completed.map((a) => {
              return (
                <Link
                  key={a.id}
                  href={`/vendor-workflow?assignment=${a.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {getCampaignDisplayName(a, campaignMap)}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      Paid: {formatCurrency(a.paymentAmount)}
                    </p>
                  </div>
                  <Badge variant="custom" className={VENDOR_STATUS_COLORS.Paid}>
                    Paid
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
      </div>
      <div className="lg:col-span-3">
        <HighlightsCard />
      </div>
      </div>
    </div>
  );
}
