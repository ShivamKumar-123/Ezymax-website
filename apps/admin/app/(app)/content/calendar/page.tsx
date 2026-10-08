"use client";

import { EmptyState } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveCalendarAdmin } from "@/components/news-live/calendar";

export default function CalendarAdminPage() {
  if (IS_DEMO) return <EmptyState illustration="calendar" title="Economic calendar" text="Connect the news service to manage calendar events." />;
  return <LiveCalendarAdmin />;
}
