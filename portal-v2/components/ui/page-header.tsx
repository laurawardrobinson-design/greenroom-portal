"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Breadcrumb text (e.g., "Pre Production", "Campaigns") */
  breadcrumb?: string;
  /** URL to navigate to when breadcrumb is clicked. If not provided, uses router.back() */
  breadcrumbHref?: string;
  /** Page title (e.g., "WF88421 Spring Organic Pasta Launch") — can be string or ReactNode for interactive titles */
  title: string | ReactNode;
  /** Optional action elements to display on the right side */
  actions?: ReactNode;
}

export function PageHeader({
  breadcrumb,
  breadcrumbHref,
  title,
  actions,
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="space-y-3 pb-4 border-b border-border">
      {breadcrumb && (
        <div className="flex items-center gap-2">
          {breadcrumbHref ? (
            <Link
              href={breadcrumbHref}
              className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span>{breadcrumb}</span>
            </Link>
          ) : (
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span>{breadcrumb}</span>
            </button>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        {typeof title === "string" ? (
          <h1 className="text-2xl font-bold text-text-primary flex-1 break-words">
            {title}
          </h1>
        ) : (
          <div className="flex-1">
            {title}
          </div>
        )}
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
