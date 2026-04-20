import { NextResponse } from "next/server";
import { requireRole, authErrorResponse, getAuthUser, requireCampaignAccess } from "@/lib/auth/guards";
import {
  getCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  getDeliverables,
  getCampaignFinancials,
} from "@/lib/services/campaigns.service";
import { getShoots } from "@/lib/services/shoots.service";
import { listSetups } from "@/lib/services/shot-list.service";
import { listCampaignProducts, listCampaignGear } from "@/lib/services/products.service";
import { listCampaignVendors } from "@/lib/services/campaign-vendors.service";
import { listCrewBookings } from "@/lib/services/crew-bookings.service";
import { updateCampaignSchema } from "@/lib/validation/campaigns.schema";

// GET /api/campaigns/[id] — campaign detail with related data
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;

    // Validate UUID format to avoid DB errors on invalid IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await requireCampaignAccess(user, id);

    const [campaign, shoots, deliverables, financials, setups, campaignProducts, campaignGear, vendors, crewBookings] = await Promise.all([
      getCampaign(id),
      getShoots(id),
      getDeliverables(id),
      getCampaignFinancials(id),
      listSetups(id),
      listCampaignProducts(id),
      listCampaignGear(id),
      listCampaignVendors(id),
      listCrewBookings(id),
    ]);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({
      campaign,
      shoots,
      deliverables,
      financials,
      setups,
      campaignProducts,
      campaignGear,
      vendors,
      crewBookings,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/campaigns/[id] — update campaign
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Creative Director"]);
    const { id } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json();

    // Art Directors can only update artDirectorId (self-assign)
    if (user.role === "Art Director") {
      const allowedKeys = Object.keys(body).filter((k) => k !== "lastUpdated");
      if (allowedKeys.length !== 1 || allowedKeys[0] !== "artDirectorId") {
        return NextResponse.json({ error: "Art Directors can only assign themselves" }, { status: 403 });
      }
      // Can only assign themselves, not someone else
      if (body.artDirectorId !== null && body.artDirectorId !== user.id) {
        return NextResponse.json({ error: "Can only assign yourself" }, { status: 403 });
      }
    }

    // Check for concurrent edit conflicts
    // Client can send lastUpdated timestamp to detect conflicts
    if (body.lastUpdated) {
      const clientVersion = new Date(body.lastUpdated);
      const current = await getCampaign(id);
      if (!current) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
      const serverVersion = new Date(current.updatedAt);

      // If server version is newer, it means someone else updated it
      if (serverVersion > clientVersion) {
        return NextResponse.json(
          {
            error: "Conflict",
            message: "This campaign was updated by someone else. Please refresh and try again.",
            current,
          },
          { status: 409 }
        );
      }
    }

    const parsed = updateCampaignSchema.parse(body);
    const campaign = await updateCampaign(id, parsed);
    return NextResponse.json(campaign);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      const zodError = error as any;
      const fieldErrors = zodError.errors?.reduce((acc: Record<string, string>, err: any) => {
        const path = err.path?.join(".") || "unknown";
        acc[path] = err.message;
        return acc;
      }, {}) || {};
      return NextResponse.json(
        { error: "Validation failed", fieldErrors },
        { status: 400 }
      );
    }
    return authErrorResponse(error);
  }
}

// POST /api/campaigns/[id] — duplicate campaign
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const newCampaign = await duplicateCampaign(id, user.id);
    return NextResponse.json(newCampaign, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/campaigns/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const result = await deleteCampaign(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return authErrorResponse(error);
  }
}
