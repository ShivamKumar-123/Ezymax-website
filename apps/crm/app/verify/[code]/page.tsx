import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BadgeCheck, ShieldX } from "lucide-react";
import { Card, Chip } from "@kalks/ui";
import { certBig, certDate, certHeadline, certMoney, publicCertificate } from "@/lib/prop";
import { VerifyActions } from "@/components/prop-live/verify-actions";
import { VerifyShell } from "@/components/prop-live/verify-shell";

// Public certificate verification: /verify/<code>. No sign-in (proxy.ts lets /verify/** through) and outside the
// (app) group, so no Client Area shell or LiveGate. The certificate is read server-side with the internal token.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

const KIND_LABEL = { pass: "Phase passed", funded: "Funded trader", payout: "Payout" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const c = await publicCertificate(code);
  if (!c || c === "unavailable") return { title: "Certificate verification", robots: { index: false } };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const image = `${proto}://${host}/verify/${c.code}/image`;
  const title = `${c.traderName} · ${certHeadline(c.kind)}`;
  const description = `${certBig(c)} · ${c.planName} · issued ${certDate(c.issuedAt)}. Verified by Kalks Prop.`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 675 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function VerifyPage({ params }: Props) {
  const { code } = await params;
  const c = await publicCertificate(code);
  if (c === null) notFound();

  if (c === "unavailable") {
    return (
      <VerifyShell>
        <Card className="mx-auto max-w-xl px-6 py-12 text-center">
          <h1 className="text-[20px] font-medium tracking-tight">Verification is unavailable right now</h1>
          <p className="mt-2 text-[14px] text-fg-3">We couldn&apos;t check this certificate at the moment. Please try again in a few minutes.</p>
        </Card>
      </VerifyShell>
    );
  }

  const rows: [string, string][] = [
    ["Trader", c.traderName],
    ["Certificate", `${KIND_LABEL[c.kind] ?? c.kind}${c.phase && c.kind === "pass" ? ` · ${c.phase}` : ""}`],
    [c.kind === "payout" ? "Payout amount" : "Account size", c.kind === "payout" && c.amount !== null ? certMoney(c.amount) : certMoney(c.size)],
    ...(c.kind === "payout" ? ([["Account size", certMoney(c.size)]] as [string, string][]) : []),
    ["Plan", c.planName],
    ["Issued", certDate(c.issuedAt)],
    ["Certificate no.", c.code],
  ];

  return (
    <VerifyShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_1fr]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-[20px] border border-line bg-[#0b0b0d]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/verify/${c.code}/image`} alt={`${certHeadline(c.kind)}: ${c.traderName}`} width={1200} height={675} className="block aspect-[1200/675] w-full" />
          </div>
        </div>
        <Card className="h-fit p-6">
          {c.valid ? (
            <div className="flex items-start gap-3 rounded-[14px] border border-up/25 bg-up-soft px-4 py-3">
              <BadgeCheck className="mt-0.5 size-5 shrink-0 text-up" />
              <div>
                <div className="text-[14px] font-medium text-up">Valid certificate</div>
                <div className="mt-0.5 text-[12.5px] text-fg-2">Issued by Kalks Prop and verified against our records.</div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-[14px] border border-down/30 bg-down-soft px-4 py-3">
              <ShieldX className="mt-0.5 size-5 shrink-0 text-down" />
              <div>
                <div className="text-[14px] font-medium text-down">Revoked certificate</div>
                <div className="mt-0.5 text-[12.5px] text-fg-2">This certificate was revoked by Kalks and is no longer valid.</div>
              </div>
            </div>
          )}
          <div className="mt-5 flex items-center gap-2">
            <h1 className="text-[20px] font-medium tracking-tight">{certHeadline(c.kind)}</h1>
            <Chip size="sm" tone={c.valid ? "up" : "down"}>
              {c.valid ? "Valid" : "Revoked"}
            </Chip>
          </div>
          <dl className="mt-4 divide-y divide-line text-[13.5px]">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-fg-3">{k}</dt>
                <dd className="k-num text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6">
            <VerifyActions code={c.code} />
          </div>
        </Card>
      </div>
    </VerifyShell>
  );
}
