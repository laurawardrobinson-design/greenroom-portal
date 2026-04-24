"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ElementType } from "react";
import { LayoutGrid, BookOpen, Type } from "lucide-react";

interface SectionTab {
  key: string;
  label: string;
  href: string;
  icon: ElementType<{ className?: string }>;
  match: (pathname: string) => boolean;
}

export function CampaignSectionTabs({
  campaignId,
  showDivider = true,
}: {
  campaignId: string;
  showDivider?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const base = `/campaigns/${campaignId}`;

  const tabs: SectionTab[] = [
    {
      key: "overview",
      label: "Overview",
      href: base,
      icon: LayoutGrid,
      match: (p) => p === base,
    },
    {
      key: "brief",
      label: "Brief",
      href: `${base}/brief`,
      icon: BookOpen,
      match: (p) => p.startsWith(`${base}/brief`),
    },
    {
      key: "copy",
      label: "Copy",
      href: `${base}/copy`,
      icon: Type,
      match: (p) => p.startsWith(`${base}/copy`),
    },
  ];

  return (
    <div className={showDivider ? "border-b border-border" : undefined}>
      <nav className="ui-tabs" role="tablist" aria-label="Campaign sections">
        {tabs.map(({ key, label, href, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={key}
              href={href}
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              data-state={active ? "active" : "inactive"}
              className="ui-tab"
            >
              <Icon className="ui-tab-icon" />
              {label}
              {active && (
                <span className="ui-tab-underline" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
