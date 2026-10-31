"use client";

// The bonus notice on the Deposit page.
//
// A client reads "25% cashback on your first deposit" on the dashboard, comes here and pays. Whether that
// earns them anything depends on things this page never mentioned: that a deposit campaign has to be claimed
// before the money arrives, that the bonus is paid onto a trading account rather than into the wallet, and
// that there is a minimum. The instructions existed, but only inside the claim dialog - behind the very step
// nobody knew to take. So they are said here, at the moment the client is about to act.
//
// It shows one of two things and otherwise nothing at all: a bonus already waiting for this deposit, or one
// that still has to be claimed first. When the broker turns on automatic granting the claim step disappears
// by itself, and so does the wording that asks for it.

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BadgePercent, Check } from "lucide-react";
import { IS_DEMO } from "@ezymex/mock/mode";
import { useT } from "@ezymex/i18n/react";
import { Button, Card, cn } from "@/components/kit";
import { useGrowth, type CampaignPublic, type Grant, type Promotions } from "./api";

/** The campaign this client could still earn on, and the grant already waiting for their deposit. */
function pick(data: Promotions | null) {
  const campaigns = (data?.campaigns ?? []).filter((c) => c.kind === "deposit");
  const waiting = (data?.grants ?? []).find((g) => g.status === "awaiting_deposit");
  const offered = campaigns.find((c) => c.eligible && !c.claimed);
  return { waiting, offered, byId: (id: Grant["campaignId"]) => campaigns.find((c) => c.id === id) };
}

function Step({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-px grid size-[18px] shrink-0 place-items-center rounded-full text-[10.5px] font-bold",
          done ? "bg-up text-white" : "bg-ember-soft text-ember",
        )}
      >
        {done ? <Check className="size-3" strokeWidth={3} /> : n}
      </span>
      <span className={cn("text-[12.5px] leading-snug", done ? "text-fg-3 line-through" : "text-fg-2")}>{children}</span>
    </li>
  );
}

export function DepositBonusNotice() {
  const t = useT();
  const { data } = useGrowth<Promotions>(IS_DEMO ? null : "promotions");
  if (IS_DEMO) return null;
  const { waiting, offered, byId } = pick(data);
  const c: CampaignPublic | undefined = waiting ? byId(waiting.campaignId) : offered;
  if (!c) return null;

  const pct = `${c.pct}%`;
  const min = `$${c.minDeposit.toLocaleString("en-US")}`;
  const cap = `$${c.cap.toLocaleString("en-US")}`;

  return (
    <Card className="mb-4 border-ember/30 bg-ember-soft/40">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:gap-4 sm:px-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ember text-white">
          <BadgePercent className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <h3 className="k-display text-[15px] font-semibold leading-tight">
              {waiting ? t("rewards.depositBonus.waitingTitle", { pct }) : t("rewards.depositBonus.offerTitle", { pct })}
            </h3>
            <p className="mt-0.5 text-[12.5px] text-fg-2">{t("rewards.depositBonus.sub", { pct, min, cap })}</p>
          </div>
          <ol className="space-y-1.5">
            {/* claiming is step one until it is done - and it vanishes for a campaign granted automatically */}
            {!waiting && <Step n={1}>{t("rewards.depositBonus.stepClaim")}</Step>}
            {waiting && <Step n={1} done>{t("rewards.depositBonus.stepClaim")}</Step>}
            <Step n={2}>{t("rewards.depositBonus.stepDeposit", { min })}</Step>
            {/* the step people miss: the bonus is paid onto a trading account, not into the wallet */}
            <Step n={3}>{t("rewards.depositBonus.stepTransfer")}</Step>
            <Step n={4}>{t("rewards.depositBonus.stepCredited", { pct })}</Step>
          </ol>
          <p className="text-[11.5px] leading-snug text-fg-3">{t("rewards.depositBonus.release", { amount: `$${c.releasePerLot}`, days: c.expiryDays })}</p>
          {!waiting && (
            <Link href="/rewards/promotions" className="inline-block">
              <Button size="sm" variant="ember">
                {t("rewards.depositBonus.claimCta")} <ArrowRight className="rtl:-scale-x-100" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
