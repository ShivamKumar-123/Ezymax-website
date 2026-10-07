"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Lock, Mail, Smartphone } from "lucide-react";
import { Card, CardHeader, PageHeader, Reveal, Toggle } from "@/components/kit";
import { IS_DEMO } from "@kalks/mock";
import { tr, useT } from "@kalks/i18n/react";

type Cat = { key: string; label: string; hint: string; locked: boolean };
type Prefs = Record<string, { inApp: boolean; email: boolean }>;

const DEMO_CATALOG: Cat[] = [
  { key: "security", label: "Security", hint: "Sign-ins from new devices, password and email changes", locked: true },
  { key: "trading_alerts", label: "Margin call and stop-out", hint: "When an account reaches its margin call or stop-out level", locked: false },
  { key: "wallet", label: "Deposits and withdrawals", hint: "Deposits credited, withdrawals approved, rejected or paid", locked: false },
  { key: "support", label: "Support replies", hint: "Replies from our support team", locked: false },
];

/** Profile -> Notifications: in-app and email per category (services/support preferences). */
export default function NotificationPreferencesPage() {
  const t = useT();
  const [catalog, setCatalog] = React.useState<Cat[] | null>(IS_DEMO ? DEMO_CATALOG : null);
  const [prefs, setPrefs] = React.useState<Prefs>(() => (IS_DEMO ? Object.fromEntries(DEMO_CATALOG.map((c) => [c.key, { inApp: true, email: true }])) : {}));
  const [error, setError] = React.useState<string | null>(null);
  // marketing emails follow the account-level consent (gateway), which the unsubscribe link also clears
  const [consent, setConsent] = React.useState<boolean | null>(IS_DEMO ? true : null);

  React.useEffect(() => {
    if (IS_DEMO) return;
    fetch("/api/notifications/prefs", { cache: "no-store" })
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as { catalog?: Cat[]; prefs?: Prefs; error?: { message?: string } };
        if (!r.ok || !d.catalog) throw new Error(d.error?.message ?? tr("profile.notifications.loadError"));
        setCatalog(d.catalog);
        setPrefs(d.prefs ?? {});
      })
      .catch((e: Error) => setError(e.message));
    fetch("/api/auth/marketing", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { marketing_consent?: boolean } | null) => typeof d?.marketing_consent === "boolean" && setConsent(d.marketing_consent))
      .catch(() => undefined);
  }, []);

  const changeConsent = async (value: boolean) => {
    const prev = consent;
    setConsent(value);
    if (IS_DEMO) return;
    const r = await fetch("/api/auth/marketing", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ consent: value }) }).catch(() => null);
    if (!r?.ok) {
      setConsent(prev);
      return toast.error(t("profile.notifications.notSaved"), { description: t("profile.notifications.tryAgain") });
    }
    toast.success(t("profile.notifications.saved"));
  };

  const change = async (key: string, channel: "inApp" | "email", value: boolean) => {
    const prev = prefs;
    setPrefs((p) => ({ ...p, [key]: { ...p[key]!, [channel]: value } }));
    if (IS_DEMO) return;
    const r = await fetch("/api/notifications/prefs", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ prefs: { [key]: { [channel]: value } } }) }).catch(() => null);
    const d = r ? ((await r.json().catch(() => ({}))) as { prefs?: Prefs; error?: { message?: string } }) : {};
    if (!r?.ok || !d.prefs) {
      setPrefs(prev);
      return toast.error(t("profile.notifications.notSaved"), { description: d.error?.message ?? t("profile.notifications.tryAgain") });
    }
    setPrefs(d.prefs);
    toast.success(t("profile.notifications.saved"));
  };

  return (
    <div className="pb-16">
      <Link href="/profile" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-fg-3 hover:text-fg">
        <ArrowLeft className="size-3.5 rtl:-scale-x-100" /> {t("profile.title")}
      </Link>
      <PageHeader title={t("profile.notifications.title")} subtitle={t("profile.notifications.subtitle")} />
      <Reveal>
        <Card className="max-w-3xl">
          <CardHeader title={t("profile.notifications.channels")} subtitle={t("profile.notifications.channelsHint")} />
          <div className="px-4 pb-4 pt-2 sm:px-6">
            <div className="hidden grid-cols-[1fr_88px_88px] items-center gap-3 border-b border-line pb-2 text-[11px] uppercase tracking-wider text-fg-3 sm:grid">
              <span>{t("profile.notifications.topic")}</span>
              <span className="flex items-center justify-center gap-1">
                <Smartphone className="size-3" /> {t("profile.notifications.inApp")}
              </span>
              <span className="flex items-center justify-center gap-1">
                <Mail className="size-3" /> {t("common.email")}
              </span>
            </div>
            {error && <div className="py-8 text-center text-[13px] text-down">{error}</div>}
            {!catalog && !error && <div className="py-8 text-center text-[13px] text-fg-3">{t("common.loading")}</div>}
            {catalog?.map((c) => {
              const p = prefs[c.key] ?? { inApp: true, email: false };
              const label = t.dyn(`profile.notifications.cat.${c.key}`, c.label);
              return (
                <div key={c.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-line py-3.5 last:border-b-0 sm:grid-cols-[1fr_88px_88px]" data-testid={`pref-${c.key}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[14px] font-medium">
                      {label}
                      {c.locked && <Lock className="size-3 text-fg-3" />}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-fg-3">{t.dyn(`profile.notifications.cat.${c.key}.hint`, c.hint)}</div>
                  </div>
                  <div className="flex justify-center" title={c.locked ? t("profile.notifications.alwaysOn") : t("profile.notifications.inApp")}>
                    {c.locked ? <span className="text-[12px] text-fg-3">{t("profile.notifications.always")}</span> : <Toggle checked={p.inApp} onChange={(v) => void change(c.key, "inApp", v)} label={t("profile.notifications.toggleInApp", { label })} />}
                  </div>
                  <div className="flex justify-center" title={c.locked ? t("profile.notifications.alwaysOn") : t("common.email")}>
                    {c.locked ? (
                      <span className="text-[12px] text-fg-3">{t("profile.notifications.always")}</span>
                    ) : c.key === "marketing" ? (
                      consent === null ? <span className="text-[12px] text-fg-3">…</span> : <Toggle checked={consent} onChange={(v) => void changeConsent(v)} label={t("profile.notifications.toggleEmail", { label })} />
                    ) : (
                      <Toggle checked={p.email} onChange={(v) => void change(c.key, "email", v)} label={t("profile.notifications.toggleEmail", { label })} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
