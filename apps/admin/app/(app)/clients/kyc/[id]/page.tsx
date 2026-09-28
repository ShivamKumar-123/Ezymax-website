"use client";

import Link from "next/link";
import { EmptyState, buttonVariants } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { KycCaseView } from "@/components/kyc/case-view";

/** One KYC case: document viewer, automatic checks, checklist and decision (live builds). */
export default function KycCasePage() {
  if (IS_DEMO)
    return (
      <EmptyState
        className="mt-10"
        title="Open a case from the queue"
        text="The demo queue opens each application in a review drawer."
        illustration="identification_card"
        action={
          <Link href="/clients/kyc" className={buttonVariants({ variant: "surface" })}>
            KYC queue
          </Link>
        }
      />
    );
  return <KycCaseView />;
}
