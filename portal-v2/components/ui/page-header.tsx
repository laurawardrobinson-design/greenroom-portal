"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Breadcrumb text (e.g., "Pre Production", "Campaigns") */
  breadcrumb?: string;
  /** Keep back navigation visible while hiding the breadcrumb label text */
  hideBreadcrumbLabel?: boolean;
  /** URL to navigate to when breadcrumb is clicked. If not provided, uses router.back() */
  breadcrumbHref?: string;
  /** Page title (e.g., "WF88421 Spring Organic Pasta Launch") — can be string or ReactNode for interactive titles */
  title: string | ReactNode;
  /** Optional action elements to display on the right side */
  actions?: ReactNode;
  /** Hide the bottom divider line under the header */
  showDivider?: boolean;
  /** When true, actions move to their own full-width row on small screens */
  stackActionsOnMobile?: boolean;
}

export function PageHeader({
  breadcrumb,
  hideBreadcrumbLabel = false,
  breadcrumbHref,
  title,
  actions,
  showDivider = true,
  stackActionsOnMobile = true,
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <div
      className="ui-page-header"
      style={showDivider ? undefined : { borderBottom: "0", paddingBottom: "0" }}
    >
      {breadcrumb && (
        <div className="flex items-center gap-[var(--density-page-header-crumb-gap)]">
          {breadcrumbHref ? (
            <Link
              href={breadcrumbHref}
              className={`flex items-center text-sm text-text-secondary hover:text-text-primary transition-colors ${
                hideBreadcrumbLabel ? "gap-0" : "gap-1"
              }`}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className={hideBreadcrumbLabel ? "sr-only" : undefined}>{breadcrumb}</span>
            </Link>
          ) : (
            <button
              onClick={() => router.back()}
              className={`flex items-center text-sm text-text-secondary hover:text-text-primary transition-colors ${
                hideBreadcrumbLabel ? "gap-0" : "gap-1"
              }`}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className={hideBreadcrumbLabel ? "sr-only" : undefined}>{breadcrumb}</span>
            </button>
          )}
        </div>
      )}

      <div className="ui-page-header-row">
        {typeof title === "string" ? (
          <h1 className="ui-page-title">
            {title}
          </h1>
        ) : (
          <div className="flex-1">
            {title}
          </div>
        )}
        {actions && (
          <div
            className={
              stackActionsOnMobile
                ? "ui-page-actions ui-page-actions--stack-mobile"
                : "ui-page-actions"
            }
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
