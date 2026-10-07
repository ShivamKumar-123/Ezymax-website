"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { Button, PageHeader } from "@/components/kit";
import { ME } from "@kalks/mock";
import { IS_DEMO as DEMO_BUILD } from "@kalks/mock/mode";
import { PROP_CERTIFICATES } from "@kalks/mock/prop";
import { CertificateCard } from "@/components/prop/certificate-card";
import { LivePropCertificates } from "@/components/prop-live/certificates";

function DemoCertificatesPage() {
  return (
    <div className="pb-24">
      <PageHeader
        title="Certificates"
        subtitle="Every phase you pass, every funded account and every payout gets a certificate with a public verify link."
        actions={
          <Link href="/prop/mine">
            <Button variant="surface" size="lg">
              <Trophy /> My challenges
            </Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {PROP_CERTIFICATES.map((c) => (
          <CertificateCard key={c.id} cert={c} name={ME.name} />
        ))}
      </div>
    </div>
  );
}

/** Live builds: the trader's certificates from the prop service (via /api/prop). Demo builds: mock certificates. */
export default function PropCertificatesPage() {
  return DEMO_BUILD ? <DemoCertificatesPage /> : <LivePropCertificates />;
}
