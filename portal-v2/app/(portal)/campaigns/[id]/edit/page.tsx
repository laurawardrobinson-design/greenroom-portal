"use client";

import { use } from "react";
import { redirect } from "next/navigation";

// Edit is now inline on the detail page — redirect there
export default function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  redirect(`/campaigns/${id}`);
}
