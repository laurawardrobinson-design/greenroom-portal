import type { CampaignStatus } from "@/types/domain";
import { CAMPAIGN_STATUS_ORDER } from "@/lib/constants/statuses";

/**
 * Validates if a status transition is allowed.
 * Only allows forward progression or transition to Cancelled.
 */
export function validateStatusTransition(
  currentStatus: CampaignStatus,
  newStatus: CampaignStatus
): { valid: boolean; reason?: string } {
  // Can always transition to Cancelled
  if (newStatus === "Cancelled") {
    return { valid: true };
  }

  // Current status can't be same as new status
  if (currentStatus === newStatus) {
    return {
      valid: false,
      reason: `Campaign is already in ${newStatus} status`,
    };
  }

  // Cancelled can only go back to Planning (reactivate)
  if (currentStatus === "Cancelled") {
    if (newStatus === "Planning") {
      return { valid: true };
    }
    return {
      valid: false,
      reason: "Cancelled campaigns can only be reactivated to Planning",
    };
  }

  // Only allow forward progression
  const currentIndex = CAMPAIGN_STATUS_ORDER.indexOf(currentStatus);
  const newIndex = CAMPAIGN_STATUS_ORDER.indexOf(newStatus);

  if (newIndex <= currentIndex) {
    return {
      valid: false,
      reason: `Cannot move backward from ${currentStatus} to ${newStatus}`,
    };
  }

  return { valid: true };
}
