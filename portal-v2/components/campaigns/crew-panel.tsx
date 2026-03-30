"use client";

// This component is now deprecated — crew is managed per-shoot
// via the ShootsSection component. This file kept for backward
// compatibility with any imports but delegates to shoot-level crew.

import { useState } from "react";
import useSWR from "swr";
import type { ShootCrew, AppUser } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Users } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  campaignId: string;
}

export function CrewPanel({ campaignId }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Crew</CardTitle>
      </CardHeader>
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="Crew is managed per shoot"
        description="Add crew members in the shoots section above."
      />
    </Card>
  );
}
