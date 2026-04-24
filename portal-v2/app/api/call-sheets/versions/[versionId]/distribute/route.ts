import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  createDistributions,
  listDistributions,
  type DistributionRecipientInput,
} from "@/lib/services/call-sheet.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Art Director",
      "Studio",
    ]);
    const { versionId } = await params;
    const distributions = await listDistributions(versionId);
    return NextResponse.json(distributions);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const user = await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Art Director",
    ]);
    const { versionId } = await params;
    const body = (await request.json()) as {
      recipients?: DistributionRecipientInput[];
    };

    const recipients = Array.isArray(body.recipients) ? body.recipients : [];
    if (recipients.length === 0) {
      return NextResponse.json({ error: "No recipients" }, { status: 400 });
    }

    // Basic validation — every recipient needs an email + tier
    for (const r of recipients) {
      if (!r.recipientEmail || typeof r.recipientEmail !== "string") {
        return NextResponse.json(
          { error: "Every recipient needs an email" },
          { status: 400 }
        );
      }
      if (r.tier !== "full" && r.tier !== "redacted") {
        return NextResponse.json(
          { error: "Every recipient needs a tier ('full' or 'redacted')" },
          { status: 400 }
        );
      }
    }

    const created = await createDistributions(versionId, recipients, user.id);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
