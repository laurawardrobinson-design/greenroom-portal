import { describe, expect, it } from "vitest";
import { generatePOPdf } from "@/lib/utils/pdf-generator";

describe("generatePOPdf", () => {
  it("renders a PDF buffer in a node runtime", () => {
    const doc = generatePOPdf({
      vendorName: "Acme Photo",
      vendorContact: "Taylor Vendor",
      vendorEmail: "taylor@example.com",
      vendorPhone: "555-0100",
      campaignName: "Spring Launch",
      wfNumber: "WF999999",
      poDate: "2026-04-08",
      poNumber: "PO-WF999999",
      items: [
        {
          description: "Photography services",
          quantity: 1,
          unitPrice: 2500,
          amount: 2500,
        },
      ],
      totalAmount: 2500,
    });

    const bytes = doc.output("arraybuffer");
    expect(bytes.byteLength).toBeGreaterThan(500);
  });
});
