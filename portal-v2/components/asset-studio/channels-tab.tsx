"use client";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { AppUser } from "@/types/domain";
import { Megaphone } from "lucide-react";

interface Props {
  user: AppUser;
}

export function ChannelsTab(_props: Props) {
  void _props;
  return (
    <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
      <EmptyState
        icon={<Megaphone className="h-5 w-5" />}
        title="Channels — coming in Sprint 2"
        description="Push approved variants to social and ad platforms (Meta, Pinterest, Pcom). For now, download approved variants from the Variants tab and upload manually."
      />
    </Card>
  );
}
