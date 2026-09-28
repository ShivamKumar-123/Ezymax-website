"use client";

import * as React from "react";
import { Eye, EyeOff, Loader2, Lock, Server, UserRound } from "lucide-react";
import { cn } from "@kalks/ui";
import { Check } from "@/components/ui/primitives";
import { SAVED_KEY } from "@/lib/store";
import { engineApi, type AuthResult } from "@/lib/engine/client";
import type { EngineErr } from "@/lib/engine/map";

export const LIVE_SERVERS = ["Kalks-Live", "Kalks-Demo"] as const;
export type LiveServer = (typeof LIVE_SERVERS)[number];

/** Logins remembered on this device (never passwords). */
export interface SavedLogin {
  login: string;
  server: LiveServer;
  at: number;
}

export function readSavedLogins(): SavedLogin[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const list = raw ? (JSON.parse(raw) as Partial<SavedLogin>[]) : [];
    return list
      .filter((s): s is SavedLogin => typeof s?.login === "string" && /^\d{8}$/.test(s.login) && (s.server === "Kalks-Live" || s.server === "Kalks-Demo"))
      .slice(0, 8);
  } catch {
    return [];
  }
}
export function writeSavedLogins(list: SavedLogin[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* storage blocked */
  }
}

/** Demo logins start at 50 000 001, live at 10 000 001 (engine numbering). */
export const serverForLogin = (login: string): LiveServer | null => (/^\d{8}$/.test(login) ? (login.startsWith("5") ? "Kalks-Demo" : "Kalks-Live") : null);

function loginError(e: EngineErr): string {
  switch (e.code) {
    case "invalid_credentials":
      return "Invalid account or password.";
    case "locked":
      return "Too many failed attempts. This login is locked for 15 minutes.";
    case "rate_limited":
      return "Too many attempts. Wait a minute and try again.";
    case "unavailable":
      return "The trade server is unavailable. Try again shortly.";
    case "wrong_server":
    case "validation":
      return e.message;
    default:
      return e.status === 403 ? e.message || "This account can't log in." : e.message || "Login failed.";
  }
}

/**
 * MT5-style "Login to trade account": login, password (trading or investor), server. The investor
 * password opens a read-only session; the server decides, the form only sends what was typed.
 */
export function EngineLoginForm({ initialLogin = "", onSuccess, autoFocus, className, footer }: { initialLogin?: string; onSuccess: (r: AuthResult) => void; autoFocus?: boolean; className?: string; footer?: React.ReactNode }) {
  const [login, setLogin] = React.useState(initialLogin);
  const [password, setPassword] = React.useState("");
  const [server, setServer] = React.useState<LiveServer>(serverForLogin(initialLogin) ?? "Kalks-Live");
  const [remember, setRemember] = React.useState(true);
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const pwRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLogin(initialLogin);
    const s = serverForLogin(initialLogin);
    if (s) setServer(s);
    if (initialLogin) pwRef.current?.focus();
  }, [initialLogin]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const l = login.trim();
    if (!/^\d{8}$/.test(l)) return setError("Enter your 8-digit account number (login).");
    if (!password) return setError("Enter your trading or investor password.");
    const expected = serverForLogin(l);
    if (expected && expected !== server) return setError(`Account ${l} is on ${expected}, not ${server}.`);
    setBusy(true);
    const r = await engineApi.login(l, password, server);
    setBusy(false);
    if (!r.ok) {
      setPassword("");
      return setError(loginError(r.err));
    }
    const saved = readSavedLogins().filter((s) => s.login !== l);
    writeSavedLogins(remember ? [{ login: l, server, at: Date.now() }, ...saved] : saved);
    onSuccess(r.data);
  };

  return (
    <form onSubmit={submit} className={cn("space-y-3.5", className)} aria-label="Login to trade account">
      <Field label="Login" icon={<UserRound />}>
        <input
          value={login}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 8);
            setLogin(v);
            const s = serverForLogin(v);
            if (s) setServer(s);
          }}
          inputMode="numeric"
          autoComplete="username"
          autoFocus={autoFocus && !initialLogin}
          placeholder="Account number"
          className="h-full w-full bg-transparent font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-fg-3"
          aria-label="Login"
        />
      </Field>
      <Field
        label="Password"
        icon={<Lock />}
        trailing={
          <button type="button" onClick={() => setShow(!show)} className="text-fg-3 hover:text-fg" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }
      >
        <input ref={pwRef} value={password} onChange={(e) => setPassword(e.target.value)} type={show ? "text" : "password"} autoComplete="current-password" placeholder="Trading or investor password" className="h-full w-full bg-transparent text-[13px] outline-none placeholder:text-fg-3" aria-label="Password" />
      </Field>
      <Field label="Server" icon={<Server />}>
        <select value={server} onChange={(e) => setServer(e.target.value as LiveServer)} className="t-select h-full w-full bg-transparent text-[13px] outline-none" aria-label="Server">
          {LIVE_SERVERS.map((s) => (
            <option key={s} value={s}>
              {s} · {s === "Kalks-Demo" ? "Demo accounts" : "Real accounts"}
            </option>
          ))}
        </select>
      </Field>
      <Check checked={remember} onChange={setRemember} label="Save login on this device" />
      <p className="text-[11.5px] leading-relaxed text-fg-3">The investor password opens a read-only session: quotes, charts, positions and history, no trading.</p>
      {error && (
        <div role="alert" className="rounded-[7px] border border-down/30 bg-down-soft px-3 py-2 text-[12px] text-down">
          {error}
        </div>
      )}
      <button type="submit" disabled={busy} className="flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-ember text-[13.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-70">
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Connecting to {server}…
          </>
        ) : (
          <>Log in</>
        )}
      </button>
      {footer}
    </form>
  );
}

function Field({ label, icon, trailing, children }: { label: string; icon: React.ReactNode; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] font-medium text-fg-2">{label}</span>
      <span className="flex h-10 items-center gap-2.5 rounded-[8px] border border-line bg-surface-2 px-3 transition-colors focus-within:border-ember/60 focus-within:ring-4 focus-within:ring-ember/10">
        <span className="text-fg-3 [&>svg]:size-4">{icon}</span>
        {children}
        {trailing}
      </span>
    </label>
  );
}
