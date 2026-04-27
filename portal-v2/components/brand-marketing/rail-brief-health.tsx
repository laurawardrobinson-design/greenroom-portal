import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { BrandMarketingPortfolio } from "@/lib/services/brand-marketing.service";

interface RailBriefHealthProps {
  briefHealth: BrandMarketingPortfolio["briefHealth"];
}

export function RailBriefHealth({ briefHealth }: RailBriefHealthProps) {
  const total = briefHealth?.total ?? 0;
  const withBrief = briefHealth?.withBrief ?? 0;
  const missing = briefHealth?.missing ?? [];
  const percent = total > 0 ? Math.round((withBrief / total) * 100) : 0;

  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader>
        <CardTitle>
          <FileText />
          <span>Brief health</span>
        </CardTitle>
        <span className="text-[13px] font-normal text-text-tertiary normal-case tracking-normal">
          {total === 0
            ? "no campaigns"
            : `${withBrief} of ${total} · ${percent}%`}
        </span>
      </CardHeader>
      <div className="px-4 py-4">
        {total === 0 ? (
          <p className="text-sm text-text-secondary">
            Nothing in flight to brief yet.
          </p>
        ) : (
          <>
            <div
              className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full transition-all"
                style={{ width: `${percent}%`, backgroundColor: "var(--color-success)" }}
              />
            </div>
            {missing.length > 0 ? (
              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                  Missing a brief
                </p>
                <ul className="mt-2 space-y-1.5">
                  {missing.slice(0, 4).map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm">
                      <span className="text-xs text-text-tertiary">
                        {c.wfNumber}
                      </span>
                      <Link
                        href={`/brand-marketing/campaigns/${c.id}`}
                        className="text-text-primary hover:text-primary truncate"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                  {missing.length > 4 && (
                    <li className="text-[11px] text-text-tertiary">
                      + {missing.length - 4} more
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-sm text-text-secondary">
                Every in-flight campaign has a brief. Nice work.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
