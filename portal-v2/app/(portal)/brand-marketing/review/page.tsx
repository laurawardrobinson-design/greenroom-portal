"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Apple,
  Beef,
  Cookie,
  Sandwich,
  ShoppingBasket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import type { PRDepartment } from "@/types/domain";
import { PR_DEPARTMENTS } from "@/types/domain";

const ALLOWED_ROLES = [
  "Admin",
  "Brand Marketing Manager",
  "Producer",
  "Post Producer",
] as const;

const DEPT_ICONS: Record<PRDepartment, LucideIcon> = {
  Bakery: Cookie,
  Produce: Apple,
  Deli: Sandwich,
  "Meat-Seafood": Beef,
  Grocery: ShoppingBasket,
};

export default function BrandMarketingReviewIndexPage() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser();

  if (isLoading || !user) return <DashboardSkeleton />;
  if (!ALLOWED_ROLES.includes(user.role as any)) {
    router.replace("/dashboard");
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-1 text-[12px] text-text-tertiary mb-1">
          <Sparkles className="h-3 w-3" />
          Brand Marketing
        </div>
        <PageHeader title="Review" />
        <p className="text-[13px] text-text-tertiary mt-1">
          Pick a department to see open flags, coming-soon products, and items in planning.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {PR_DEPARTMENTS.map((dept) => {
          const Icon = DEPT_ICONS[dept];
          return (
            <Link
              key={dept}
              href={`/brand-marketing/review/${dept}`}
              className="group block"
            >
              <Card
                padding="lg"
                className="flex h-full flex-col items-center gap-3 text-center transition-colors hover:border-primary/40 hover:bg-surface-secondary/50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold text-text-primary">{dept}</div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
