"use client";

import useSWR from "swr";
import type {
  CampaignListItem,
  Campaign,
  CampaignStatus,
  Shoot,
  CampaignDeliverable,
  CampaignFinancials,
  ShotListSetup,
  CampaignProduct,
  CampaignGearLink,
  CampaignVendor,
} from "@/types/domain";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

// Stable empty-array fallbacks — prevents useEffect([setups]) infinite loops
// when SWR hasn't loaded yet (data?.x || [] creates a new ref each render)
const EMPTY_SHOOTS: Shoot[] = [];
const EMPTY_DELIVERABLES: CampaignDeliverable[] = [];
const EMPTY_SETUPS: ShotListSetup[] = [];
const EMPTY_PRODUCTS: CampaignProduct[] = [];
const EMPTY_GEAR: CampaignGearLink[] = [];
const EMPTY_VENDORS: CampaignVendor[] = [];

export function useCampaigns(filters?: {
  status?: CampaignStatus;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.search) params.set("search", filters.search);
  const qs = params.toString();
  const key = `/api/campaigns${qs ? `?${qs}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<CampaignListItem[]>(key, fetcher);

  return {
    campaigns: data || [],
    isLoading,
    isError: !!error,
    mutate,
  };
}

interface CampaignDetail {
  campaign: Campaign;
  shoots: Shoot[];
  deliverables: CampaignDeliverable[];
  financials: CampaignFinancials;
  setups: ShotListSetup[];
  campaignProducts: CampaignProduct[];
  campaignGear: CampaignGearLink[];
  vendors: CampaignVendor[];
}

export function useCampaign(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<CampaignDetail>(
    id ? `/api/campaigns/${id}` : null,
    fetcher,
    {
      errorRetryCount: 3,
      errorRetryInterval: 500,
    }
  );

  return {
    campaign: data?.campaign ?? null,
    shoots: data?.shoots ?? EMPTY_SHOOTS,
    deliverables: data?.deliverables ?? EMPTY_DELIVERABLES,
    financials: data?.financials ?? { committed: 0, spent: 0, budget: 0, remaining: 0 },
    setups: data?.setups ?? EMPTY_SETUPS,
    campaignProducts: data?.campaignProducts ?? EMPTY_PRODUCTS,
    campaignGear: data?.campaignGear ?? EMPTY_GEAR,
    vendors: data?.vendors ?? EMPTY_VENDORS,
    isLoading,
    isError: !!error,
    mutate,
  };
}
