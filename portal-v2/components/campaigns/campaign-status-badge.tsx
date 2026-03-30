import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUS_COLORS } from "@/lib/constants/statuses";
import type { CampaignStatus } from "@/types/domain";

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <Badge variant="custom" className={CAMPAIGN_STATUS_COLORS[status]}>
      {status}
    </Badge>
  );
}
