"use client";

import * as React from "react";
import { Award } from "lucide-react";
import { Card, CardHeader, Chip, PageHeader } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveCertificatesPage } from "@/components/prop-live/certificates";

export default function CertificatesPage() {
  return IS_DEMO ? <DemoCertificatesPage /> : <LiveCertificatesPage />;
}

const DEMO_CERTS = [
  { code: "K7Q2M9TX4P", kind: "Funded trader", trader: "Aarav S.", plan: "Ezymex Classic 2-Step", amount: "$100,000", issued: "22 Sep 2026" },
  { code: "R3N8WJ5CZL", kind: "Payout", trader: "Lina M.", plan: "Ezymex Rapid 1-Step", amount: "$4,812.50", issued: "21 Sep 2026" },
  { code: "D9F4HB2QVE", kind: "Phase passed", trader: "Tomás R.", plan: "Ezymex Classic 2-Step", amount: "$50,000", issued: "19 Sep 2026" },
  { code: "P6Y1KX8MSA", kind: "Phase passed", trader: "Chen W.", plan: "Ezymex Classic 2-Step", amount: "$25,000", issued: "17 Sep 2026" },
];

function DemoCertificatesPage() {
  return (
    <div className="pb-24">
      <PageHeader title="Certificates" subtitle="Pass, funded and payout certificates with a public verify link." />
      <Card>
        <CardHeader icon={<Award />} title="Recent certificates" subtitle="Sample data" />
        <div className="divide-y divide-line px-4 pb-4 pt-3 sm:px-6">
          {DEMO_CERTS.map((c) => (
            <div key={c.code} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13px]">
              <span className="min-w-0">
                <span className="font-mono text-[12.5px]">{c.code}</span>
                <span className="block text-[12px] text-fg-3">
                  {c.trader} · {c.plan}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <Chip size="sm" tone={c.kind === "Funded trader" ? "gold" : c.kind === "Payout" ? "ember" : "up"}>
                  {c.kind}
                </Chip>
                <span className="k-num w-24 text-right">{c.amount}</span>
                <span className="w-24 text-right text-[12px] text-fg-3">{c.issued}</span>
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
