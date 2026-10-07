"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Field, Input, Toggle } from "@/components/kit";
import { FormError, PasswordStrength } from "@/components/auth";
import { PasswordInput } from "@/components/accounts/security";
import { STEPUP_CODES, StepUpDialog } from "@/components/stepup";
import { authPost } from "@/lib/auth-client";
import { useT } from "@kalks/i18n/react";

/** Same rules as the gateway (validate::password). */
function passwordProblem(p: string) {
  if (p.length < 8) return "profile.password.rule.min" as const;
  if (p.length > 128) return "profile.password.rule.max" as const;
  if (!/[A-Z]/.test(p)) return "profile.password.rule.upper" as const;
  if (!/[a-z]/.test(p)) return "profile.password.rule.lower" as const;
  if (!/[0-9]/.test(p)) return "profile.password.rule.number" as const;
  if (!/[^A-Za-z0-9]/.test(p)) return "profile.password.rule.symbol" as const;
  return null;
}

/** Client Area password change: current + new password, confirmed with an emailed code (D20). */
export function ChangePasswordCard({ onForgot }: { onForgot: () => void }) {
  const t = useT();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [repeat, setRepeat] = React.useState("");
  const [others, setOthers] = React.useState(true);
  const [confirming, setConfirming] = React.useState(false);
  const [errs, setErrs] = React.useState<{ current?: string; next?: string; form?: string }>({});

  const problem = next ? passwordProblem(next) : null;
  const ready = !!current && !!next && !problem && next === repeat && next !== current;

  const save = async (token: string) => {
    const r = await authPost<{ sessions_revoked: number }>("password", { current, new: next, stepup_token: token, sign_out_others: others });
    if (!r.ok) {
      const e = r.error;
      if (e.code === "unauthorized") {
        window.location.assign("/api/auth/expired?next=/profile");
        return;
      }
      if (e.field === "current") setErrs({ current: e.message });
      else if (e.field === "new") setErrs({ next: e.message });
      else setErrs({ form: STEPUP_CODES.has(e.code) ? t("profile.password.expired") : e.message });
      return;
    }
    setCurrent("");
    setNext("");
    setRepeat("");
    setErrs({});
    const n = r.data.sessions_revoked ?? 0;
    toast.success(t("profile.password.changed"), { description: n ? t("profile.password.signedOutOthers", { count: n }) : t("profile.password.useNextTime") });
  };

  return (
    <Card>
      <CardHeader title={t("profile.password.title")} subtitle={t("profile.password.subtitle")} icon={<KeyRound />} />
      <form method="post"
        className="grid grid-cols-1 gap-4 px-6 pb-6 pt-2 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          setErrs({});
          setConfirming(true);
        }}
      >
        {errs.form && (
          <div className="md:col-span-2">
            <FormError>{errs.form}</FormError>
          </div>
        )}
        <Field label={t("profile.password.current")} error={errs.current} className="md:col-span-2">
          <Input
            type="password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setErrs((x) => ({ ...x, current: undefined }));
            }}
            placeholder={t("profile.password.currentPlaceholder")}
            autoComplete="current-password"
          />
        </Field>
        <Field label={t("profile.password.new")} error={errs.next ?? (next && next === current ? t("profile.password.sameAsCurrent") : undefined)}>
          <PasswordInput
            value={next}
            onChange={(v) => {
              setNext(v);
              setErrs((x) => ({ ...x, next: undefined }));
            }}
            placeholder={t("profile.password.newPlaceholder")}
          />
          <PasswordStrength value={next} />
        </Field>
        <Field label={t("profile.password.confirm")} error={repeat && repeat !== next ? t("profile.password.mismatch") : undefined}>
          <PasswordInput value={repeat} onChange={setRepeat} placeholder={t("profile.password.confirmPlaceholder")} />
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-[14px] border border-line bg-surface-2 px-4 py-3 md:col-span-2">
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium">{t("profile.password.signOutOthers")}</div>
            <div className="text-[12px] text-fg-3">{t("profile.password.signOutOthersHint")}</div>
          </div>
          <Toggle checked={others} onChange={setOthers} label={t("profile.password.signOutOthers")} />
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
          <button type="button" onClick={onForgot} className="text-start text-[12.5px] text-fg-3 hover:text-fg">
            {t("profile.password.forgot")}
          </button>
          <Button type="submit" variant="ember" disabled={!ready || confirming}>
            {t("profile.password.submit")}
          </Button>
        </div>
      </form>
      {confirming && (
        <StepUpDialog
          open={confirming}
          onOpenChange={setConfirming}
          action="account_password"
          title={t("profile.password.stepupTitle")}
          description={t("profile.password.stepupDescription")}
          what={t("profile.password.stepupWhat")}
          confirmLabel={t("profile.password.stepupConfirm")}
          onConfirmed={save}
        />
      )}
    </Card>
  );
}
