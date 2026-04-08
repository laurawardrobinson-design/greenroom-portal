import { describe, expect, it } from "vitest";
import { VENDOR_STATUS_TRANSITIONS } from "@/lib/constants/statuses";

describe("VENDOR_STATUS_TRANSITIONS", () => {
  it("supports estimate revision request loop", () => {
    expect(VENDOR_STATUS_TRANSITIONS["Estimate Submitted"]).toContain(
      "Estimate Revision Requested"
    );
    expect(
      VENDOR_STATUS_TRANSITIONS["Estimate Revision Requested"]
    ).toContain("Estimate Submitted");
  });

  it("keeps final rejection path intact", () => {
    expect(VENDOR_STATUS_TRANSITIONS["Estimate Submitted"]).toContain(
      "Rejected"
    );
    expect(VENDOR_STATUS_TRANSITIONS.Rejected).toContain("Invited");
  });
});
