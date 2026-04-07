import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    const db = createAdminClient();
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "mine";
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
      const showAll = scope === "all";

      // Get campaigns — either mine or all active
      let campaignQuery = db
        .from("campaigns")
        .select("id, name, wf_number, status")
        .neq("status", "Complete")
        .neq("status", "Cancelled")
        .order("created_at", { ascending: false });

      if (!showAll) {
        campaignQuery = campaignQuery.eq("created_by", user.id);
      }

      const { data: rawCampaigns } = await campaignQuery;

      const myCampaigns = rawCampaigns || [];
      const myCampaignIds = myCampaigns.map((c: any) => c.id as string);

      // Parallel: pending vendor actions + shoots
      const [pendingVendorResult, myShootsResult] = await Promise.all([
        myCampaignIds.length > 0
          ? db
              .from("campaign_vendors")
              .select("id, status, campaign_id, campaigns(id, name), vendors(id, company_name)")
              .in("status", ["Estimate Submitted", "PO Uploaded", "Invoice Submitted"])
              .in("campaign_id", myCampaignIds)
          : Promise.resolve({ data: [] }),
        myCampaignIds.length > 0
          ? db.from("shoots").select("id, name, campaign_id").in("campaign_id", myCampaignIds)
          : Promise.resolve({ data: [] }),
      ]);

      const pendingVendorRows = pendingVendorResult.data || [];
      const myShootRows = myShootsResult.data || [];
      const myShootIds = myShootRows.map((s: any) => s.id as string);

      // Shoots this week
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
        type: row.status === "Estimate Submitted" ? "Review Estimate" : row.status === "Invoice Submitted" ? "Review Invoice" : "Review PO",
        campaignId: row.campaign_id as string,
        campaignName: (row.campaigns as any)?.name || "Unknown Campaign",
        vendorName: (row.vendors as any)?.company_name || "Unknown Vendor",
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

    if (user.role === "Art Director") {
      const thirtyDaysOut = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
      const fourteenDaysOut = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

      // 1a. Active crew bookings for this user, joined with campaigns
      const { data: bookingRows } = await db
        .from("crew_bookings")
        .select("id, campaign_id, role, day_rate, status, campaigns(id, name, wf_number, status, assets_delivery_date)")
        .eq("user_id", user.id)
        .not("status", "in", '("Cancelled","Completed")');

      const bookings = bookingRows || [];
      const bookingIds = bookings.map((b: any) => b.id as string);
      const bookingCampaignIds = new Set(bookings.map((b: any) => b.campaign_id as string));

      // 1b. Campaigns where this user is assigned as Art Director (even without crew bookings)
      const { data: adCampaignRows } = await db
        .from("campaigns")
        .select("id, name, wf_number, status, assets_delivery_date")
        .eq("art_director_id", user.id)
        .neq("status", "Complete")
        .neq("status", "Cancelled");

      const adCampaigns = (adCampaignRows || []).filter(
        (c: any) => !bookingCampaignIds.has(c.id as string)
      );

      const campaignIds = [...new Set([
        ...bookings.map((b: any) => b.campaign_id as string),
        ...adCampaigns.map((c: any) => c.id as string),
      ])];

      // 2. Upcoming shoot dates from those bookings
      const { data: dateRows } = bookingIds.length > 0
        ? await db
            .from("crew_booking_dates")
            .select("id, booking_id, shoot_date, confirmed")
            .in("booking_id", bookingIds)
            .gte("shoot_date", today)
            .lte("shoot_date", fourteenDaysOut)
            .order("shoot_date")
        : { data: [] };

      const upcomingDates = dateRows || [];

      // Build booking → campaign lookup
      const bookingMap = new Map(bookings.map((b: any) => [b.id, b]));

      const activeBookingsList = [
        ...bookings.map((b: any) => {
          const c = b.campaigns as any;
          return {
            id: b.id,
            campaignId: b.campaign_id,
            campaignName: c?.name || "",
            wfNumber: c?.wf_number || "",
            campaignStatus: c?.status || "",
            role: b.role,
            dayRate: Number(b.day_rate),
            status: b.status,
          };
        }),
        ...adCampaigns.map((c: any) => ({
          id: `ad-${c.id}`,
          campaignId: c.id,
          campaignName: c.name || "",
          wfNumber: c.wf_number || "",
          campaignStatus: c.status || "",
          role: "Art Director",
          dayRate: 0,
          status: "Assigned",
        })),
      ];

      const upcomingShootsList = upcomingDates.map((d: any) => {
        const booking = bookingMap.get(d.booking_id) as any;
        const c = booking?.campaigns as any;
        return {
          bookingId: d.booking_id,
          campaignName: c?.name || "",
          wfNumber: c?.wf_number || "",
          shootDate: d.shoot_date,
          confirmed: d.confirmed,
        };
      });

      // 3. Count campaigns with assets due in next 30 days
      const bookingAssetsDue = bookings.filter((b: any) => {
        const c = b.campaigns as any;
        return c?.assets_delivery_date && c.assets_delivery_date >= today && c.assets_delivery_date <= thirtyDaysOut;
      }).length;
      const adAssetsDue = adCampaigns.filter((c: any) =>
        c.assets_delivery_date && c.assets_delivery_date >= today && c.assets_delivery_date <= thirtyDaysOut
      ).length;
      const assetsDueSoon = bookingAssetsDue + adAssetsDue;

      // 4. Shot progress per active campaign
      let shotProgress: any[] = [];
      if (campaignIds.length > 0) {
        const [{ data: setups }, { data: shots }] = await Promise.all([
          db.from("shot_list_setups").select("id, campaign_id").in("campaign_id", campaignIds),
          db.from("shot_list_shots").select("id, campaign_id, status").in("campaign_id", campaignIds),
        ]);

        const campaignNameMap = new Map(
          bookings.map((b: any) => [b.campaign_id, (b.campaigns as any)?.name || ""])
        );

        const setupCounts = new Map<string, number>();
        (setups || []).forEach((s: any) => setupCounts.set(s.campaign_id, (setupCounts.get(s.campaign_id) || 0) + 1));

        const shotCounts = new Map<string, { total: number; completed: number }>();
        (shots || []).forEach((s: any) => {
          const prev = shotCounts.get(s.campaign_id) || { total: 0, completed: 0 };
          prev.total++;
          if (s.status === "Complete") prev.completed++;
          shotCounts.set(s.campaign_id, prev);
        });

        shotProgress = campaignIds.map((cid) => ({
          campaignId: cid,
          campaignName: campaignNameMap.get(cid) || "",
          totalSetups: setupCounts.get(cid) || 0,
          totalShots: shotCounts.get(cid)?.total || 0,
          completedShots: shotCounts.get(cid)?.completed || 0,
        }));
      }

      // 5. Growth goal
      const { data: goalRow } = await db
        .from("user_goals")
        .select("id, goal_text")
        .eq("user_id", user.id)
        .maybeSingle();

      let goal = null;
      if (goalRow) {
        const { data: milestones } = await db
          .from("goal_milestones")
          .select("id, completed")
          .eq("goal_id", goalRow.id);

        const ms = milestones || [];
        goal = {
          goalText: goalRow.goal_text,
          milestonesCompleted: ms.filter((m: any) => m.completed).length,
          milestonesTotal: ms.length,
        };
      }

      return NextResponse.json({
        activeBookings: activeBookingsList.length,
        activeBookingsList,
        upcomingShoots: upcomingShootsList.length,
        upcomingShootsList,
        assetsDueSoon,
        shotProgress,
        goal,
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
