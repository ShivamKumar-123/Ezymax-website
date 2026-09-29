"use client";

import { EmptyState } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveCalendarAdmin } from "@/components/news-live/calendar";

export default function CalendarAdminPage() {
  if (IS_DEMO) return <EmptyState illustration="calendar" title="Economic calendar" text="Connect the news service to manage calendar events." />;
  return <LiveCalendarAdmin />;
}
