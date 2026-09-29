"use client";

import { Card, EmptyState, PageHeader } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LivePromotionsPage } from "@/components/growth/promotions";

function DemoPromotionsPage() {
  return (
    <div className="pb-16">
      <PageHeader title="Promotions" subtitle="Deposit bonuses, trading credit and promo codes." />
      <Card>
        <EmptyState illustration="wrapped_gift" title="No promotions in the demo" text="Bonus campaigns and promo codes are available in the live Client Area." />
      </Card>
    </div>
  );
}

export default function Page() {
  return IS_DEMO ? <DemoPromotionsPage /> : <LivePromotionsPage />;
}
