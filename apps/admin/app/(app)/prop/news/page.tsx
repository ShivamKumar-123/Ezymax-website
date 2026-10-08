"use client";

import * as React from "react";
import { CalendarClock } from "lucide-react";
import { Card, CardHeader, Chip, PageHeader } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveNewsPage } from "@/components/prop-live/news";

export default function NewsCalendarPage() {
  return IS_DEMO ? <DemoNewsPage /> : <LiveNewsPage />;
}

const DEMO_NEWS = [
  { at: "2026-10-02 12:30 UTC", ccy: "USD", impact: "high", title: "Non-Farm Payrolls" },
  { at: "2026-10-01 14:00 UTC", ccy: "USD", impact: "high", title: "ISM Manufacturing PMI" },
  { at: "2026-09-30 09:00 UTC", ccy: "EUR", impact: "medium", title: "Flash CPI (y/y)" },
  { at: "2026-09-29 23:50 UTC", ccy: "JPY", impact: "low", title: "Retail Sales (m/m)" },
];

function DemoNewsPage() {
  return (
    <div className="pb-24">
      <PageHeader title="News calendar" subtitle="High-impact events for the news-window rule." />
      <Card>
        <CardHeader icon={<CalendarClock />} title="Upcoming events" subtitle="Sample data" />
        <div className="divide-y divide-line px-4 pb-4 pt-3 sm:px-6">
          {DEMO_NEWS.map((e) => (
            <div key={e.title} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13px]">
              <span className="min-w-0">
                <span className="block">{e.title}</span>
                <span className="k-num block text-[12px] text-fg-3">{e.at}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="font-mono text-[12.5px]">{e.ccy}</span>
                <Chip size="sm" dot tone={e.impact === "high" ? "down" : e.impact === "medium" ? "warn" : "neutral"} className="capitalize">
                  {e.impact}
                </Chip>
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
