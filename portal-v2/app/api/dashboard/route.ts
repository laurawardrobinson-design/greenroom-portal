import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const user = await getAuthUser();
    const db = createAdminClient();
    const today = new Date().toISOString().split("T")[0];
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

    if (user.role === "Admin") {
      // HOP stats
      const [
        { data: campaigns },
        { data: pendingRequests },
        { data: pendingInvoices },
        { data: shootsThisWeek },
        { data: pools },
      ] = await Promise.all([
        db.from("campaigns").select("production_budget").neq("status", "Complete").neq("status", "Cancelled"),
        db.from("budget_requests").select("id").eq("status", "Pending"),
        db.from("campaign_vendors").select("id").eq("status", "Invoice Pre-Approved"),
        db.from("shoot_dates").select("id").gte("shoot_date", today).lte("shoot_date", weekEnd),
        db.from("budget_pools").select("total_amount"),
      ]);

      const totalBudget = (pools || []).reduce((s, p) => s + Number(p.total_amount), 0);
      const committed = (campaigns || []).reduce((s, c) => s + Number(c.production_budget), 0);
      const pendingCount = (pendingRequests?.length || 0) + (pendingInvoices?.length || 0);

      return NextResponse.json({
        totalBudget,
        committed,
        pendingApprovals: pendingCount,
        shootsThisWeek: shootsThisWeek?.length || 0,
      });
    }

    if (user.role === "Producer") {
      // Get producer's active campaigns with details
      const { data: rawCampaigns } = await db
        .from("campaigns")
        .select("id, name, wf_number, status")
        .eq("created_by", user.id)
        .neq("status", "Complete")
        .neq("status", "Cancelled")
        .order("created_at", { ascending: false });

      const myCampaigns = rawCampaigns || [];
      const myCampaignIds = myCampaigns.map((c: any) => c.id as string);

      // Parallel: pending vendor actions + my shoots
      const [pendingVendorResult, myShootsResult] = await Promise.all([
        myCampaignIds.length > 0
          ? db
              .from("campaign_vendors")
              .select("id, status, campaign_id, campaigns(id, name), vendors(id, name)")
              .in("status", ["Estimate Submitted", "PO Uploaded"])
              .in("campaign_id", myCampaignIds)
          : Promise.resolve({ data: [] }),
        myCampaignIds.length > 0
          ? db.from("shoots").select("id, name, campaign_id").in("campaign_id", myCampaignIds)
          : Promise.resolve({ data: [] }),
      ]);

      const pendingVendorRows = pendingVendorResult.data || [];
      const myShootRows = myShootsResult.data || [];
      const myShootIds = myShootRows.map((s: any) => s.id as string);

      // Shoots this week (filtered to producer's campaigns)
      const weekShootDatesResult =
        myShootIds.length > 0
          ? await db
              .from("shoot_dates")
              .select("id, shoot_date, location, call_time, shoot_id")
              .gte("shoot_date", today)
              .lte("shoot_date", weekEnd)
              .in("shoot_id", myShootIds)
              .order("shoot_date")
          : { data: [] };

      const weekShootDates = weekShootDatesResult.data || [];

      // Build lookup maps for enrichment
      const shootMapById = new Map(myShootRows.map((s: any) => [s.id, s]));
      const campaignMapById = new Map(myCampaigns.map((c: any) => [c.id, c]));

      const activeCampaignsList = myCampaigns.map((c: any) => ({
        id: c.id as string,
        name: c.name as string,
        wfNumber: c.wf_number as string,
        status: c.status as string,
      }));

      const pendingTasksList = pendingVendorRows.map((row: any) => ({
        id: row.id as string,
        type: row.status === "Estimate Submitted" ? "Review Estimate" : "Review PO",
        campaignId: row.campaign_id as string,
        campaignName: (row.campaigns as any)?.name || "Unknown Campaign",
        vendorName: (row.vendors as any)?.name || "Unknown Vendor",
      }));

      const shootsThisWeekList = weekShootDates.map((row: any) => {
        const shoot = shootMapById.get(row.shoot_id) as any;
        const campaign = shoot ? (campaignMapById.get(shoot.campaign_id) as any) : null;
        return {
          id: row.id as string,
          date: row.shoot_date as string,
          callTime: (row.call_time as string) || "",
          location: (row.location as string) || "",
          shootName: shoot?.name || "Shoot",
          campaignId: shoot?.campaign_id || "",
          campaignName: campaign?.name || "",
        };
      });

      return NextResponse.json({
        activeCampaigns: activeCampaignsList.length,
        activeCampaignsList,
        pendingTasks: pendingTasksList.length,
        pendingTasksList,
        shootsThisWeek: shootsThisWeekList.length,
        shootsThisWeekList,
      });
    }

    if (user.role === "Studio") {
      const [
        { data: myShootRows },
        { data: myCheckouts },
        { data: overdueCheckouts },
      ] = await Promise.all([
        db.from("shoot_crew").select("shoot_id, shoots!inner(campaign_id)").eq("user_id", user.id),
        db.from("gear_checkouts").select("id").eq("user_id", user.id).is("checked_in_at", null),
        db.from("gear_checkouts").select("id").is("checked_in_at", null).lt("expected_return_date", today),
      ]);

      return NextResponse.json({
        upcomingShoots: myShootRows?.length || 0,
        gearCheckedOut: myCheckouts?.length || 0,
        overdueReturns: overdueCheckouts?.length || 0,
      });
    }

    if (user.role === "Vendor" && user.vendorId) {
      const { data: assignments } = await db
        .from("campaign_vendors")
        .select("id, status")
        .eq("vendor_id", user.vendorId)
        .neq("status", "Paid")
        .neq("status", "Rejected");

      return NextResponse.json({
        activeAssignments: assignments?.length || 0,
      });
    }

    return NextResponse.json({});
  } catch (error) {
    return authErrorResponse(error);
  }
}
