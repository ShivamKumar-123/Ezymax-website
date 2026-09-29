"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, EmptyState } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveContestDetail } from "@/components/growth/contest-detail";

function DemoContestDetail() {
  return (
    <Card>
      <EmptyState
        illustration="trophy"
        title="Contest details"
        text="Rules, prizes and the full leaderboard of each contest open here in the live Client Area."
        action={
          <Link href="/rewards">
            <Button variant="surface">Back to contests</Button>
          </Link>
        }
      />
    </Card>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return IS_DEMO ? <DemoContestDetail /> : <LiveContestDetail id={id} />;
}
