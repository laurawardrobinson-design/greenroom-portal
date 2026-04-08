import { NextResponse } from "next/server";
import {
  getAuthUser,
  requireCampaignAccess,
  requireCampaignVendorAccess,
  authErrorResponse,
} from "@/lib/auth/guards";
import { listCampaignAssets, uploadCampaignAsset } from "@/lib/services/files.service";
import type { AssetCategory } from "@/types/domain";

type PdfTextItem = { str?: string };

function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return null;
  return Math.round(amount * 100) / 100;
}

function detectEstimateTotal(text: string): number | null {
  type Candidate = { value: number; score: number; index: number };
  const candidates: Candidate[] = [];

  const strongPattern =
    /(?:grand\s+total|estimate\s+total|total\s+estimate|amount\s+due|balance\s+due|total\s+due)\s*[:\-]?\s*\$?\s*([0-9][0-9,]*(?:\.\d{2})?)/gi;
  let match: RegExpExecArray | null;
  while ((match = strongPattern.exec(text)) !== null) {
    const value = parseCurrency(match[1] || "");
    if (value !== null) {
      candidates.push({ value, score: 3, index: match.index });
    }
  }

  const loosePattern = /(?:^|\s)total\s*[:\-]?\s*\$?\s*([0-9][0-9,]*(?:\.\d{2})?)/gi;
  while ((match = loosePattern.exec(text)) !== null) {
    const value = parseCurrency(match[1] || "");
    if (value !== null) {
      candidates.push({ value, score: 2, index: match.index });
    }
  }

  const fallbackPattern = /\$([0-9][0-9,]*(?:\.\d{2})?)/g;
  while ((match = fallbackPattern.exec(text)) !== null) {
    const value = parseCurrency(match[1] || "");
    if (value !== null) {
      candidates.push({ value, score: 1, index: match.index });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.index !== a.index) return b.index - a.index;
    return b.value - a.value;
  });

  return candidates[0].value;
}

async function extractEstimateTotalFromPdf(fileBuffer: ArrayBuffer): Promise<number | null> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fileBuffer);
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
  const pdfDocument = await loadingTask.promise;

  let text = "";
  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum += 1) {
    const page = await pdfDocument.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = (content.items as PdfTextItem[])
      .map((item) => item.str || "")
      .join(" ");
    text += `${pageText}\n`;
  }

  return detectEstimateTotal(text);
}

function extractEstimateTotalFromRawPdfBytes(fileBuffer: ArrayBuffer): number | null {
  const rawText = new TextDecoder("latin1").decode(new Uint8Array(fileBuffer));
  const labeledMatch = rawText.match(
    /(?:total\s+estimate|estimate\s+total|grand\s+total|amount\s+due|balance\s+due|total\s+due)[^0-9$]{0,24}\$?([0-9][0-9,]*(?:\.\d{2})?)/i
  );
  if (!labeledMatch) return null;
  return parseCurrency(labeledMatch[1] || "");
}

// GET /api/files?campaignId=xxx&type=fun|boring
export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const type = searchParams.get("type") as "fun" | "boring" | null;

    if (!campaignId) {
      return NextResponse.json({ error: "campaignId required" }, { status: 400 });
    }

    await requireCampaignAccess(user, campaignId);
    const assets = await listCampaignAssets(campaignId, type || undefined);
    return NextResponse.json(assets);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/files — upload a file
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const campaignIdFromBody = formData.get("campaignId") as string | null;
    const campaignVendorId = formData.get("campaignVendorId") as string | null;
    const category = formData.get("category") as AssetCategory;
    let campaignId = campaignIdFromBody || "";

    if (!file || !category || (!campaignIdFromBody && !campaignVendorId)) {
      return NextResponse.json(
        { error: "file, category, and campaignId or campaignVendorId are required" },
        { status: 400 }
      );
    }

    // Validate file type — only allow known safe MIME types
    const ALLOWED_TYPES = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "video/mp4",
      "video/quicktime",
      "text/csv",
      "application/zip",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/msword",
    ];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Enforce 50MB size limit server-side
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 50MB limit" },
        { status: 400 }
      );
    }

    // Vendor upload restrictions
    if (user.role === "Vendor") {
      const allowed: AssetCategory[] = ["Deliverable", "Invoice", "Estimate"];
      if (!allowed.includes(category)) {
        return NextResponse.json(
          { error: "Vendors can only upload Deliverables, Estimates, and Invoices" },
          { status: 403 }
        );
      }
    }

    if (campaignVendorId) {
      const assignment = await requireCampaignVendorAccess(user, campaignVendorId);
      campaignId = assignment.campaign_id;
    } else {
      await requireCampaignAccess(user, campaignId);
    }

    const buffer = await file.arrayBuffer();
    let parsedEstimateTotal: number | null = null;
    const isPdfEstimate =
      category === "Estimate" &&
      (file.type === "application/pdf" ||
        file.type === "application/x-pdf" ||
        file.name.toLowerCase().endsWith(".pdf"));

    if (isPdfEstimate) {
      try {
        parsedEstimateTotal = await extractEstimateTotalFromPdf(buffer);
      } catch (parseError) {
        console.warn("[Estimate Parse] Failed to parse uploaded estimate PDF", parseError);
      }

      // Fallback: parse from raw PDF bytes when text extraction fails.
      if (parsedEstimateTotal === null) {
        parsedEstimateTotal = extractEstimateTotalFromRawPdfBytes(buffer);
      }
    }

    const asset = await uploadCampaignAsset({
      campaignId,
      uploadedBy: user.id,
      vendorId: user.vendorId || undefined,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      category,
      fileBuffer: buffer,
    });

    // Keep `url` as a backward-compatible alias while clients migrate to `fileUrl`.
    return NextResponse.json(
      {
        ...asset,
        url: asset.fileUrl,
        ...(category === "Estimate" ? { parsedEstimateTotal } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
