"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Field, Input, Toggle } from "@kalks/ui";
import { FormError, PasswordStrength } from "@/components/auth";
import { PasswordInput } from "@/components/accounts/security";
import { STEPUP_CODES, StepUpDialog } from "@/components/stepup";
import { authPost } from "@/lib/auth-client";

/** Same rules as the gateway (validate::password). */
function passwordProblem(p: string): string | null {
  if (p.length < 8) return "Use at least 8 characters.";
  if (p.length > 128) return "Use at most 128 characters.";
  if (!/[A-Z]/.test(p)) return "Add an uppercase letter.";
  if (!/[a-z]/.test(p)) return "Add a lowercase letter.";
  if (!/[0-9]/.test(p)) return "Add a number.";
  if (!/[^A-Za-z0-9]/.test(p)) return "Add a symbol such as ! # @ or %.";
  return null;
}

/** Client Area password change: current + new password, confirmed with an emailed code (D20). */
export function ChangePasswordCard({ onForgot }: { onForgot: () => void }) {
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
      else setErrs({ form: STEPUP_CODES.has(e.code) ? "The confirmation expired. Save again to get a new code." : e.message });
      return;
    }
    setCurrent("");
    setNext("");
    setRepeat("");
    setErrs({});
    const n = r.data.sessions_revoked ?? 0;
    toast.success("Password changed", { description: n ? `Signed out of ${n} other session${n === 1 ? "" : "s"}.` : "Use it the next time you sign in." });
  };

  return (
    <Card>
      <CardHeader title="Change password" subtitle="For signing in to the Client Area. We email you a code to confirm the change." icon={<KeyRound />} />
      <form
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
        <Field label="Current password" error={errs.current} className="md:col-span-2">
          <Input
            type="password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setErrs((x) => ({ ...x, current: undefined }));
            }}
            placeholder="Your current password"
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password" error={errs.next ?? (next && next === current ? "Choose a password different from your current one." : undefined)}>
          <PasswordInput
            value={next}
            onChange={(v) => {
              setNext(v);
              setErrs((x) => ({ ...x, next: undefined }));
            }}
            placeholder="New password"
          />
          <PasswordStrength value={next} />
        </Field>
        <Field label="Confirm new password" error={repeat && repeat !== next ? "Passwords don't match" : undefined}>
          <PasswordInput value={repeat} onChange={setRepeat} placeholder="Repeat new password" />
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-[14px] border border-line bg-surface-2 px-4 py-3 md:col-span-2">
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium">Sign out of other devices</div>
            <div className="text-[12px] text-fg-3">Ends every other Client Area session. This device stays signed in.</div>
          </div>
          <Toggle checked={others} onChange={setOthers} label="Sign out of other devices" />
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
          <button type="button" onClick={onForgot} className="text-left text-[12.5px] text-fg-3 hover:text-fg">
            Forgot your current password? Reset it by email
          </button>
          <Button type="submit" variant="ember" disabled={!ready || confirming}>
            Change password
          </Button>
        </div>
      </form>
      {confirming && (
        <StepUpDialog
          open={confirming}
          onOpenChange={setConfirming}
          action="account_password"
          title="Confirm password change"
          description="Your Client Area sign-in password"
          what="change your Client Area password"
          confirmLabel="Confirm & change"
          onConfirmed={save}
        />
      )}
    </Card>
  );
}
