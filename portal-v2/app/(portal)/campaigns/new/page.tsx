"use client";

import { redirect } from "next/navigation";

// Campaign creation is now handled by a modal on the campaigns list page
export default function NewCampaignPage() {
  redirect("/campaigns");
}
