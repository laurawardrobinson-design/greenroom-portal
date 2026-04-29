import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PR_DEPARTMENT_LABELS } from "@/types/domain";
import type { PRDepartment } from "@/types/domain";
import { RBUSidebar } from "@/components/rbu/rbu-sidebar";
import { ToastProvider } from "@/components/ui/toast";

export const dynamic = "force-dynamic";

async function resolveDepartment(token: string): Promise<PRDepartment | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("product_request_dept_calendars")
    .select("department")
    .eq("public_token", token)
    .maybeSingle();
  if (!data) return null;
  return (data as Record<string, unknown>).department as PRDepartment;
}

export default async function RBUDeptLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const department = await resolveDepartment(token);
  if (!department) notFound();

  const deptLabel = PR_DEPARTMENT_LABELS[department];

  return (
    <ToastProvider>
      <div className="flex h-full min-h-screen bg-surface print:bg-white">
        <RBUSidebar
          token={token}
          department={department}
          deptLabel={deptLabel}
        />
        <div className="flex min-w-0 flex-1 flex-col lg:pl-[245px]">
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-[var(--density-page-content-px)] py-[var(--density-page-content-py)] lg:px-[var(--density-page-content-px-lg)]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
