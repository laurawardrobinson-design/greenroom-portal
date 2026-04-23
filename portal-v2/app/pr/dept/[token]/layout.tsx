import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PR_DEPARTMENT_LABELS } from "@/types/domain";
import type { PRDepartment } from "@/types/domain";
import { RBUSidebar } from "@/components/rbu/rbu-sidebar";

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
    <div className="min-h-screen bg-neutral-100 print:bg-white">
      <RBUSidebar
        token={token}
        department={department}
        deptLabel={deptLabel}
      />
      <div className="lg:pl-[245px] min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}
