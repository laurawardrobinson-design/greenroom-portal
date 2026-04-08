import { describe, expect, it } from "vitest";
import {
  buildFinanceEmailDraft,
  type FinanceHandoffDraftInput,
} from "@/lib/services/finance-handoffs.service";

describe("buildFinanceEmailDraft", () => {
  it("creates a finance-ready subject, body, and summary payload", () => {
    const input: FinanceHandoffDraftInput = {
      wfNumber: "WF210601",
      campaignName: "Grilling Social Cutdowns",
      vendorName: "Fresh Focus Photography",
      vendorContact: "Alex Vendor",
      vendorEmail: "alex@freshfocus.com",
      poNumber: "PO-WF210601",
      estimateTotal: 5000,
      invoiceTotal: 4800,
      variance: -200,
      invoiceFileName: "Invoice-FFP-April.pdf",
      invoiceFileUrl: "https://example.com/invoice.pdf",
      submittedAt: "2026-04-01T09:00:00.000Z",
      producerApprovedAt: "2026-04-02T13:30:00.000Z",
      hopApprovedAt: "2026-04-03T16:45:00.000Z",
      lineItems: [
        { description: "Photography services", amount: 4300 },
        { description: "Travel", amount: 500 },
      ],
    };

    const draft = buildFinanceEmailDraft(input, {
      to: ["finance@example.com"],
      cc: ["producer@example.com"],
    });

    expect(draft.subject).toContain("WF210601");
    expect(draft.subject).toContain("Fresh Focus Photography");
    expect(draft.body).toContain("Estimate Total: $5,000");
    expect(draft.body).toContain("Invoice Total: $4,800");
    expect(draft.body).toContain("Photography services");
    expect(draft.to).toEqual(["finance@example.com"]);
    expect(draft.cc).toEqual(["producer@example.com"]);
    expect(draft.summary.wfNumber).toBe("WF210601");
  });
});
