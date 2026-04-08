import { describe, expect, it } from "vitest";
import { submitEstimateSchema } from "@/lib/validation/estimates.schema";

const basePayload = {
  campaignVendorId: "550e8400-e29b-41d4-a716-446655440000",
  items: [
    {
      category: "Other",
      description: "Estimate total",
      quantity: 1,
      unitPrice: 1000,
      amount: 1000,
    },
  ],
};

describe("submitEstimateSchema", () => {
  it("accepts estimate file metadata when provided", () => {
    const parsed = submitEstimateSchema.parse({
      ...basePayload,
      estimateFileUrl: "https://example.com/estimate.pdf",
      estimateFileName: "estimate.pdf",
    });

    expect(parsed.estimateFileUrl).toBe("https://example.com/estimate.pdf");
    expect(parsed.estimateFileName).toBe("estimate.pdf");
  });

  it("accepts null estimate file metadata for manual entry mode", () => {
    const parsed = submitEstimateSchema.parse({
      ...basePayload,
      estimateFileUrl: null,
      estimateFileName: null,
    });

    expect(parsed.estimateFileUrl).toBeNull();
    expect(parsed.estimateFileName).toBeNull();
  });
});
