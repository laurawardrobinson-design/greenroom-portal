import Image from "next/image";
import Link from "next/link";
import {
  Apple,
  Beef,
  Cookie,
  Sandwich,
  ShoppingBasket,
  type LucideIcon,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PR_DEPARTMENTS, PR_DEPARTMENT_LABELS } from "@/types/domain";
import type { PRDepartment } from "@/types/domain";

export const dynamic = "force-dynamic";

const DEPT_ICONS: Record<PRDepartment, LucideIcon> = {
  Bakery: Cookie,
  Produce: Apple,
  Deli: Sandwich,
  "Meat-Seafood": Beef,
  Grocery: ShoppingBasket,
};

async function loadDeptTokens(): Promise<Record<PRDepartment, string | null>> {
  const db = createAdminClient();
  const { data } = await db
    .from("product_request_dept_calendars")
    .select("department, public_token");
  const out: Record<PRDepartment, string | null> = {
    Bakery: null,
    Produce: null,
    Deli: null,
    "Meat-Seafood": null,
    Grocery: null,
  };
  for (const row of data ?? []) {
    const r = row as { department: PRDepartment; public_token: string };
    out[r.department] = r.public_token;
  }
  return out;
}

export default async function RBULandingPage() {
  const tokens = await loadDeptTokens();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-sidebar px-4 pt-16 pb-12 sm:pt-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-8 max-w-[260px]">
            <Image
              src="/greenroom-logo.png"
              alt="Greenroom — Publix Creative Studio"
              width={260}
              height={76}
              priority
              className="w-full h-auto"
            />
          </div>
          <p className="text-sm font-medium tracking-wide text-white/60">
            The smarter way to run production.
          </p>
        </div>

        <div className="rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/10 p-6">
          <p className="mb-4 text-center text-xs text-white/50">
            Select your department to sign in
          </p>

          <div className="space-y-2">
            {PR_DEPARTMENTS.map((dept) => {
              const token = tokens[dept];
              const Icon = DEPT_ICONS[dept];
              const label = PR_DEPARTMENT_LABELS[dept];

              const body = (
                <>
                  <Icon className="h-4 w-4 shrink-0 text-white/80" />
                  <span className="flex-1">{label}</span>
                </>
              );

              if (!token) {
                return (
                  <div
                    key={dept}
                    aria-disabled
                    className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white/40 cursor-not-allowed"
                  >
                    {body}
                  </div>
                );
              }

              return (
                <Link
                  key={dept}
                  href={`/pr/dept/${token}`}
                  prefetch={false}
                  className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white hover:bg-white/15 transition-all"
                >
                  {body}
                </Link>
              );
            })}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-white/40">
          Read-only · maintained by Brand Marketing
        </p>
      </div>
    </div>
  );
}
