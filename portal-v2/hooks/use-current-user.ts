"use client";

import useSWR from "swr";
import type { AppUser } from "@/types/domain";

async function fetchUser(): Promise<AppUser> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

export function useCurrentUser() {
  const { data, error, isLoading, mutate } = useSWR<AppUser>(
    "/api/auth/me",
    fetchUser,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    user: data ?? null,
    isLoading,
    isError: !!error,
    mutate,
  };
}
