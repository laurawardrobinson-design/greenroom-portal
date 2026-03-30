"use client";

import useSWR from "swr";
import type { Vendor } from "@/types/domain";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export function useVendors(filters?: { search?: string; category?: string }) {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.category) params.set("category", filters.category);
  const qs = params.toString();
  const key = `/api/vendors${qs ? `?${qs}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<Vendor[]>(key, fetcher);

  return {
    vendors: data || [],
    isLoading,
    isError: !!error,
    mutate,
  };
}
