"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, ChevronDown, Copy, Mail } from "lucide-react";
import { Button, Card, CardHeader, PageHeader, Reveal } from "@kalks/ui";
import { useSession } from "@/components/session";
import { SUPPORT_EMAIL, TERMINAL_URL } from "@/lib/live";

function copy(text: string, what: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success(`${what} copied`),
    () => toast.error("Couldn't copy, please select it instead"),
  );
}

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "When can I deposit?",
    a: "The Kalks wallet with USDT deposits and withdrawals on the TRC20 network is the next release. We will email you as soon as it is live.",
  },
  {
    q: "How do I verify my identity?",
    a: "Online identity verification (KYC) opens with the next release. We will email you when you can upload your documents here in the Client Area.",
  },
  {
    q: "Where can I see charts and live prices?",
    a: (
      <>
        Open{" "}
        <a href={TERMINAL_URL} target="_blank" rel="noopener" className="text-ember hover:underline">
          Kalks Trader
        </a>{" "}
        for real-time quotes and charts, or the{" "}
        <Link href="/markets" className="text-ember hover:underline">
          Markets
        </Link>{" "}
        page for a live overview of every instrument.
      </>
    ),
  },
  {
    q: "I forgot my password",
    a: (
      <>
        Use <span className="text-fg">Forgot password</span> on the sign-in page, or <span className="text-fg">Reset password</span> on your{" "}
        <Link href="/profile" className="text-ember hover:underline">
          Profile
        </Link>
        . We'll email you a code to set a new one.
      </>
    ),
  },
  {
    q: "How do I change my personal details?",
    a: `Details can't be edited online yet. Write to ${SUPPORT_EMAIL} from your registered email address with the correction and your client ID.`,
  },
];

/** Live builds: real contact channel and honest answers — no sample chat, agents or articles. */
export function LiveSupport() {
  const me = useSession();
  const id = `KL-${String(me.id).padStart(6, "0")}`;
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Support request · ${id}`)}`;
  return (
    <div className="pb-16">
      <PageHeader title="Support" subtitle="Questions about your account or the platform? Our team answers by email." />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-5">
          <Card hot className="flex h-full flex-col p-6">
            <span className="grid size-12 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
              <Mail className="size-5" />
            </span>
            <div className="mt-5 text-[13px] text-fg-3">Email support</div>
            <div className="mt-1 break-all font-mono text-[20px] font-medium">{SUPPORT_EMAIL}</div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-fg-2">
              Write from your registered address <span className="text-fg">{me.email}</span> so we can find your account straight away.
            </p>
            <div className="mt-5 rounded-[14px] border border-line bg-surface-2 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">Your client ID</div>
                  <div className="k-num mt-0.5 font-mono text-[15px] font-semibold">{id}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(id, "Client ID")}>
                  <Copy /> Copy
                </Button>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-2 pt-6">
              <a href={mailto} className="flex-1">
                <Button variant="ember" className="w-full">
                  <Mail /> Write to support
                </Button>
              </a>
              <Button variant="surface" onClick={() => copy(SUPPORT_EMAIL, "Email address")}>
                <Copy /> Copy address
              </Button>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.05} className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader title="Common questions" subtitle="Where the platform stands today" />
            <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
              {FAQ.map((f, i) => (
                <details key={f.q} className="k-row group px-4 py-3 [&_summary::-webkit-details-marker]:hidden" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-medium">
                    {f.q}
                    <ChevronDown className="size-4 shrink-0 text-fg-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 text-[13.5px] leading-relaxed text-fg-2">{f.a}</div>
                </details>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4 block">
        <Card className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium">Looking for prices or charts?</div>
            <div className="mt-0.5 text-[13px] text-fg-2">Kalks Trader streams live quotes and charts in your browser.</div>
          </div>
          <a href={TERMINAL_URL} target="_blank" rel="noopener">
            <Button variant="surface">
              Launch Kalks Trader <ArrowUpRight />
            </Button>
          </a>
        </Card>
      </Reveal>
    </div>
  );
}
