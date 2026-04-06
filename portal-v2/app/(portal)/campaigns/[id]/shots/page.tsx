"use client";

import { use } from "react";
import { redirect } from "next/navigation";

export default function ShotsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  redirect(`/campaigns/${id}/pre-production`);
}
