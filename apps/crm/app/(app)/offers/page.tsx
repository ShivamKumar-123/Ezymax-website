"use client";

import { Card, EmptyState, PageHeader } from "@/components/kit";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveOffersPage } from "@/components/growth/offers";

function DemoOffersPage() {
  return (
    <div className="pb-16">
      <PageHeader title="Offers" subtitle="Everything the broker is running right now." />
      <Card>
        <EmptyState illustration="wrapped_gift" title="No offers in the demo" text="Live offers are published from the Back Office and appear here." />
      </Card>
    </div>
  );
}

export default function Page() {
  return IS_DEMO ? <DemoOffersPage /> : <LiveOffersPage />;
}
