"use client";

// A11 master tools on the master dashboard: who can follow (limit, accepting new, private invite link) and announcements.

import * as React from "react";
import { Copy as CopyIcon, Link2, Loader2, Megaphone, RefreshCw, Send, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Field, Input, Toggle, cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { socialApi, type Announcement, type MasterUpdateResult, type MasterView } from "./api";
import { InfoBox, useNumber } from "./bits";
import { AnnouncementList } from "./execution";

const textareaCls =
  "w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10";

function SettingRow({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="k-row flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium">{title}</div>
        <div className="text-[12px] leading-snug text-fg-3">{text}</div>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

/** Max followers, "accept new followers" and the private (invite-only) copy link: PATCH master/me. */
export function FollowerSettingsCard({ m, followers, onSaved, className }: { m: MasterView; followers: number; onSaved: () => void; className?: string }) {
  const t = useT();
  const [acceptNew, setAcceptNew] = React.useState(m.acceptNew ?? true);
  const [inviteOnly, setInviteOnly] = React.useState(m.inviteOnly ?? false);
  const maxF = useNumber(m.maxFollowers ?? null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);
  // follow the server after each save / poll
  React.useEffect(() => setAcceptNew(m.acceptNew ?? true), [m.acceptNew]);
  React.useEffect(() => setInviteOnly(m.inviteOnly ?? false), [m.inviteOnly]);
  React.useEffect(() => {
    maxF.set(m.maxFollowers ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.maxFollowers]);

  const maxErr = maxF.raw && !(Number.isInteger(maxF.value) && maxF.value! >= 0 && maxF.value! <= 100_000) ? t("social.md.fol.maxErr") : undefined;
  const maxDirty = !maxErr && (maxF.value ?? null) !== (m.maxFollowers ?? null);
  const link = m.inviteCode ? `${origin}/social/masters/${m.id}?invite=${m.inviteCode}` : "";
  const accepting = m.acceptingNew !== false;

  const patch = async (key: string, body: Record<string, unknown>, ok: string, desc?: string, revert?: () => void) => {
    setBusy(key);
    try {
      await socialApi<MasterUpdateResult>("master/me", { method: "PATCH", body });
      toast.success(ok, { description: desc });
      onSaved();
    } catch (e) {
      revert?.();
      toast.error(t("social.md.fol.saveFailed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard?.writeText(link).then(
      () => toast.success(t("social.md.fol.linkCopied"), { description: t("social.md.fol.linkCopiedDesc") }),
      () => toast.error(t("social.md.fol.copyFailed")),
    );
  };

  return (
    <Card className={className} data-testid="master-follower-settings">
      <CardHeader
        title={t("social.md.fol.title")}
        subtitle={t("social.md.fol.subtitle")}
        icon={<UserCog />}
        action={
          <Chip size="sm" tone={accepting ? "up" : "warn"}>
            {accepting ? t("social.md.fol.open") : t("social.notAccepting")}
            {typeof m.maxFollowers === "number" ? ` · ${followers}/${m.maxFollowers}` : ""}
          </Chip>
        }
      />
      <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
        <SettingRow title={t("social.md.fol.acceptNew")} text={t("social.md.fol.acceptNewText")}>
          <span className="flex items-center gap-2">
            {busy === "acceptNew" && <Loader2 className="size-3.5 animate-spin text-fg-3" />}
            <Toggle
              checked={acceptNew}
              label={t("social.md.fol.acceptNew")}
              onChange={(v) => {
                setAcceptNew(v);
                void patch("acceptNew", { acceptNew: v }, v ? t("social.md.fol.toast.open") : t("social.md.fol.toast.closed"), v ? undefined : t("social.md.fol.toast.closedDesc"), () => setAcceptNew(!v));
              }}
            />
          </span>
        </SettingRow>

        <div className="k-row px-4 py-3">
          <div className="text-[13.5px] font-medium">{t("social.md.fol.max")}</div>
          <div className="text-[12px] leading-snug text-fg-3">{t("social.md.fol.maxText")}</div>
          <div className="mt-2.5 flex items-start gap-2">
            <Field label={t("social.md.fol.max")} error={maxErr} className="flex-1 [&>span:first-child]:sr-only">
              <Input type="number" inputMode="numeric" min={0} max={100000} step={1} placeholder={t("social.md.fol.noLimit")} value={maxF.raw} onChange={(e) => maxF.setRaw(e.target.value)} inputClassName="k-num" />
            </Field>
            <Button
              variant="surface"
              disabled={!maxDirty || busy === "max"}
              onClick={() => patch("max", { maxFollowers: maxF.value }, t("social.md.fol.toast.maxSaved"), maxF.value === null ? t("social.md.fol.toast.noLimitDesc") : t("social.md.fol.toast.maxDesc", { n: maxF.value }))}
            >
              {busy === "max" && <Loader2 className="animate-spin" />} {t("common.save")}
            </Button>
          </div>
        </div>

        <SettingRow title={t("social.md.fol.inviteOnly")} text={t("social.md.fol.inviteOnlyText")}>
          <span className="flex items-center gap-2">
            {busy === "inviteOnly" && <Loader2 className="size-3.5 animate-spin text-fg-3" />}
            <Toggle
              checked={inviteOnly}
              label={t("social.md.fol.inviteOnly")}
              onChange={(v) => {
                setInviteOnly(v);
                void patch("inviteOnly", { inviteOnly: v }, v ? t("social.md.fol.toast.private") : t("social.md.fol.toast.public"), v ? t("social.md.fol.toast.privateDesc") : t("social.md.fol.toast.publicDesc"), () => setInviteOnly(!v));
              }}
            />
          </span>
        </SettingRow>

        {inviteOnly && m.inviteOnly && (
          <div className="rounded-[14px] border border-gold/25 bg-gold-soft px-4 py-3" data-testid="master-invite-link">
            <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
              <Link2 className="size-3.5 text-gold" /> {t("social.md.fol.link")}
            </div>
            {link ? (
              <>
                <div className="truncate rounded-[10px] border border-line bg-surface-2 px-3 py-2 font-mono text-[12px] text-fg-2" title={link}>
                  {link}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="xs" variant="ember" onClick={copyLink}>
                    <CopyIcon /> {t("social.md.fol.copyLink")}
                  </Button>
                  <Button
                    size="xs"
                    variant="surface"
                    disabled={busy === "regen"}
                    onClick={() => patch("regen", { regenerateInvite: true }, t("social.md.fol.toast.newLink"), t("social.md.fol.toast.newLinkDesc"))}
                  >
                    {busy === "regen" ? <Loader2 className="animate-spin" /> : <RefreshCw />} {t("social.md.fol.newLink")}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-[12px] text-fg-3">{t("social.md.fol.linkPending")}</p>
            )}
            <p className="mt-2 text-[11.5px] leading-snug text-fg-3">{t("social.md.fol.linkNote")}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Compose an announcement to every follower still copying (POST master/announcements) and the ones sent before. */
export function AnnouncementsCard({ items, onSent, className }: { items: Announcement[]; onSent: () => void; className?: string }) {
  const t = useT();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState<Announcement[] | null>(null);
  const list = sent ?? items;
  // a newer list from the dashboard poll replaces the one returned by the last send
  const itemsKey = items.map((a) => a.id).join(",");
  React.useEffect(() => setSent(null), [itemsKey]);
  const ok = title.trim().length >= 3 && title.trim().length <= 120 && body.length <= 2000;

  const send = async () => {
    if (!ok) return toast.error(t("social.md.ann.err"));
    setBusy(true);
    try {
      const r = await socialApi<{ announcement: Announcement; items: Announcement[] }>("master/announcements", { body: { title: title.trim(), ...(body.trim() ? { body: body.trim() } : {}) } });
      setSent(r.items ?? null);
      toast.success(t("social.md.ann.sent"), { description: t("social.md.ann.sentDesc", { count: r.announcement?.recipients ?? 0 }) });
      setTitle("");
      setBody("");
      onSent();
    } catch (e) {
      toast.error(t("social.md.ann.failed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={className} data-testid="master-announcements">
      <CardHeader title={t("social.md.ann.title")} subtitle={t("social.md.ann.subtitle")} icon={<Megaphone />} />
      <div className="grid grid-cols-1 gap-5 px-4 pb-5 pt-4 sm:px-6 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label={t("social.md.ann.titleLabel")} hint={`${title.length}/120`}>
            <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={t("social.md.ann.titlePh")} />
          </Field>
          <Field label={t("social.md.ann.message")} hint={`${body.length}/2000`}>
            <textarea value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} rows={5} placeholder={t("social.md.ann.messagePh")} className={textareaCls} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11.5px] text-fg-3">{t("social.md.ann.note")}</p>
            <Button variant="ember" onClick={send} disabled={busy || !ok} data-testid="master-announce-send">
              {busy ? <Loader2 className="animate-spin" /> : <Send />} {t("social.md.ann.send")}
            </Button>
          </div>
        </div>
        <div className={cn("min-w-0")}>
          <div className="mb-2 text-[12.5px] font-medium text-fg-2">{t("social.md.ann.past")}</div>
          <div className="max-h-[360px] overflow-y-auto">
            <AnnouncementList items={list} empty={t("social.md.ann.empty")} showRecipients />
          </div>
        </div>
      </div>
      <div className="px-4 pb-5 sm:px-6">
        <InfoBox>{t("social.md.ann.rules")}</InfoBox>
      </div>
    </Card>
  );
}
