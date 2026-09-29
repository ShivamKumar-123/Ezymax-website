"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight, CandlestickChart, Eye, EyeOff, KeyRound, Loader2, Lock, Server, ShieldCheck, Trash2, UserPlus, UserRound } from "lucide-react";
import { toast } from "@/lib/notify";
import { ACCOUNTS, INSTRUMENTS, ME } from "@kalks/mock";
import { BrandName, LivePrice, LogoMark, SymbolAvatar, ThemeToggle, cn, useQuote } from "@kalks/ui";
import { SAVED_KEY, writeActive, writeSession } from "@/lib/store";
import { SERVERS } from "@/lib/trading";
import { Badge, Check } from "@/components/ui/primitives";
import { GUEST_MODE } from "@/lib/guest";
import { EngineLoginForm, readSavedLogins, writeSavedLogins, type SavedLogin } from "@/components/account/login-form";

interface Saved {
  login: string;
  server: string;
  investor: boolean;
  savePassword: boolean;
  at: number;
}

const CLIENT_AREA = process.env.NEXT_PUBLIC_CLIENT_AREA_URL ?? "http://localhost:3000";
const REGISTER_URL = `${CLIENT_AREA}/register`;

function readSaved(): Saved[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (raw) return JSON.parse(raw) as Saved[];
  } catch {
    /* ignore */
  }
  return ACCOUNTS.slice(0, 4).map((a, i) => ({ login: a.login, server: a.server, investor: false, savePassword: i < 2, at: Date.now() - i * 86400e3 }));
}

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [login, setLogin] = React.useState(sp.get("login") ?? "");
  const [password, setPassword] = React.useState("");
  const [server, setServer] = React.useState<string>("Kalks-Live01");
  const [investor, setInvestor] = React.useState(false);
  const [savePw, setSavePw] = React.useState(true);
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(sp.get("error") === "unknown" ? `Account ${sp.get("login")} was not found. Log in manually.` : null);
  const [saved, setSaved] = React.useState<Saved[]>([]);
  React.useEffect(() => setSaved(readSaved()), []);
  React.useEffect(() => {
    if (sp.get("logout")) toast("You have been logged out", { description: "Your workspace is kept on this device." });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (s: Saved) => {
    setLogin(s.login);
    setServer(s.server);
    setInvestor(s.investor);
    setPassword(s.savePassword ? "••••••••••" : "");
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const a = ACCOUNTS.find((x) => x.login === login.trim());
    if (!/^\d{6,10}$/.test(login.trim())) return setError("Enter your numeric account number (login).");
    if (password.length < 4) return setError("Enter your master or investor password.");
    if (!a) return setError("Invalid account: no such login on the selected server.");
    if (a.server !== server) return setError(`Account ${a.login} is on ${a.server}, not ${server}.`);
    setBusy(true);
    setTimeout(() => {
      writeSession({ login: a.login, investor, server: a.server, via: "login", at: Date.now() });
      const entry: Saved = { login: a.login, server: a.server, investor, savePassword: savePw, at: Date.now() };
      const next = [entry, ...saved.filter((s) => s.login !== a.login)].slice(0, 8);
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      router.replace("/");
    }, 650);
  };

  return (
    <div className="relative flex min-h-dvh overflow-y-auto bg-page lg:h-dvh lg:overflow-hidden">
      {/* left: brand */}
      <aside className="relative hidden w-[46%] max-w-[720px] overflow-hidden border-r border-line lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/photos/trading-screen.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(7,7,10,0.35),rgba(7,7,10,0.92)_62%),radial-gradient(700px_320px_at_20%_-80px,rgba(255,90,31,0.45),transparent_70%)]" />
        <div className="relative flex h-full flex-col p-10 text-white">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-[9px] border border-white/15 bg-white/10 backdrop-blur">
              <LogoMark size={16} className="text-white" />
            </span>
            <span className="text-[16px] font-semibold tracking-tight">
              <BrandName /> <span className="font-normal text-white/70">Trader</span>
            </span>
          </div>
          <div className="mt-auto max-w-[460px]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff8a3d]">Professional trading room</div>
            <h1 className="mt-3 text-[34px] font-medium leading-[1.12] tracking-tight">Every market. One workstation.</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-white/65">Multi-chart layouts, depth of market, one-click execution, server-side trailing stops and a full toolbox. Hedging, netting, cent and demo accounts.</p>
            <div className="mt-7 grid grid-cols-2 gap-2">
              {["XAUUSD", "EURUSD", "NAS100", "BTCUSD"].map((s) => (
                <Ticker key={s} symbol={s} />
              ))}
            </div>
            <div className="mt-7 flex items-center gap-4 text-[11.5px] text-white/50">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" /> TLS 1.3 · 2FA ready
              </span>
              <span>{INSTRUMENTS.length} instruments</span>
              <span>Server time GMT+3</span>
            </div>
          </div>
        </div>
      </aside>

      {/* right: form */}
      <main className="relative flex flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[260px] bg-[radial-gradient(600px_220px_at_50%_-80px,rgba(255,90,31,0.2),transparent_70%)]" />
        <div className="relative flex items-center justify-between px-5 py-4 sm:px-8">
          <span className="flex items-center gap-2 lg:invisible">
            <span className="grid size-8 place-items-center rounded-[8px] border border-line-top bg-surface-3">
              <LogoMark size={14} className="text-fg" />
            </span>
            <span className="text-[14px] font-semibold">
              <BrandName /> <span className="font-normal text-fg-2">Trader</span>
            </span>
          </span>
          <div className="flex items-center gap-2">
            <a href={CLIENT_AREA} className="flex h-9 items-center gap-1 rounded-full border border-line px-3.5 text-[12.5px] text-fg-2 hover:bg-surface-3 hover:text-fg">
              Back to Client Area <ArrowUpRight className="size-3.5" />
            </a>
            <ThemeToggle />
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-[860px] flex-1 flex-col items-center justify-center gap-5 px-4 pb-10 lg:flex-row lg:items-start lg:pt-[8vh]">
          <form onSubmit={submit} className="w-full max-w-[400px] rounded-[12px] border border-line bg-panel shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]" aria-label="Login to trade account">
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-center gap-2 text-[15px] font-semibold">
                <KeyRound className="size-4 text-ember" /> Login to trade account
              </div>
              <p className="mt-1 text-[12px] text-fg-3">Use the login and password from your account credentials in the Client Area.</p>
            </div>
            <div className="space-y-3.5 px-5 py-4">
              <Field label="Login" icon={<UserRound />}>
                <input value={login} onChange={(e) => setLogin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="username" placeholder="e.g. 80412337" className="h-full w-full bg-transparent font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-fg-3" aria-label="Login" />
              </Field>
              <Field
                label={investor ? "Investor password" : "Password"}
                icon={<Lock />}
                trailing={
                  <button type="button" onClick={() => setShow(!show)} className="text-fg-3 hover:text-fg" aria-label={show ? "Hide password" : "Show password"}>
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              >
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" className="h-full w-full bg-transparent text-[13px] outline-none placeholder:text-fg-3" aria-label="Password" />
              </Field>
              <Field label="Server" icon={<Server />}>
                <select value={server} onChange={(e) => setServer(e.target.value)} className="t-select h-full w-full bg-transparent text-[13px] outline-none" aria-label="Server">
                  {SERVERS.map((s) => (
                    <option key={s} value={s}>
                      {s} {s.includes("Demo") ? "· Demo" : s.includes("Prop") ? "· Prop" : "· Live"}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="space-y-2 pt-0.5">
                <Check checked={savePw} onChange={setSavePw} label="Save password on this device" />
                <Check checked={investor} onChange={setInvestor} label={<span>Log in with investor (read-only) password</span>} />
              </div>
              {error && <div className="rounded-[7px] border border-down/30 bg-down-soft px-3 py-2 text-[12px] text-down">{error}</div>}
              <button type="submit" disabled={busy} className="flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-ember text-[13.5px] font-semibold text-white shadow-[0_10px_28px_-10px_rgba(255,90,31,0.8)] transition hover:brightness-110 disabled:opacity-70">
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Connecting to {server}…
                  </>
                ) : (
                  <>Log in</>
                )}
              </button>
              <div className="flex items-center justify-between text-[11.5px] text-fg-3">
                <a href={`${CLIENT_AREA}/accounts`} className="hover:text-fg">
                  Forgot password?
                </a>
                <a href={`${CLIENT_AREA}/accounts`} className="hover:text-fg">
                  Open a new account ↗
                </a>
              </div>
            </div>
          </form>

          <section className="w-full max-w-[400px] rounded-[12px] border border-line bg-panel lg:max-w-[340px]" aria-label="Saved accounts">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-2">Saved accounts</div>
              <span className="text-[11px] text-fg-3">{ME.name}</span>
            </div>
            <div className="p-1.5">
              {saved.map((s) => {
                const a = ACCOUNTS.find((x) => x.login === s.login);
                if (!a) return null;
                return (
                  <div key={s.login} className={cn("group flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 transition-colors", login === s.login ? "bg-ember-soft/60" : "hover:bg-surface-2")}>
                    <button type="button" onClick={() => pick(s)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <Badge tone={a.type === "live" ? "ember" : "gold"} className="w-11 justify-center">
                        {a.type}
                      </Badge>
                      <span className="min-w-0">
                        <span className="block font-mono text-[12.5px] text-fg">{a.login}</span>
                        <span className="block truncate text-[11px] text-fg-3">
                          {a.server} · {a.group} · {a.mode}
                          {a.cent ? " · USC" : ""}
                        </span>
                      </span>
                    </button>
                    {s.savePassword && <Lock className="size-3 text-fg-3" aria-label="Password saved" />}
                    <button
                      type="button"
                      aria-label={`Forget ${a.login}`}
                      onClick={() => {
                        const next = saved.filter((x) => x.login !== s.login);
                        setSaved(next);
                        try {
                          localStorage.setItem(SAVED_KEY, JSON.stringify(next));
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="grid size-6 place-items-center rounded-[5px] text-fg-3 opacity-0 hover:bg-surface-3 hover:text-down group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-fg-3">
              Coming from the Client Area? Every <span className="text-fg-2">Trade</span> button signs you in automatically, no password needed.
            </div>
          </section>
        </div>
      </main>
    </div>
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

function Ticker({ symbol }: { symbol: string }) {
  const q = useQuote(symbol);
  return (
    <div className="flex items-center gap-2.5 rounded-[9px] border border-white/10 bg-black/35 px-3 py-2 backdrop-blur">
      <SymbolAvatar symbol={symbol} size={18} />
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-medium text-white/85">{symbol}</div>
        <LivePrice symbol={symbol} className="text-[13px] [&>span:first-child]:text-white/60 [&>span:nth-child(2)]:text-white" />
      </div>
      <span className={cn("k-num font-mono text-[11px]", q.change >= 0 ? "text-[#22c55e]" : "text-[#f04438]")}>
        {q.change >= 0 ? "+" : ""}
        {q.change.toFixed(2)}%
      </span>
    </div>
  );
}

const LIVE_NOTICE: Record<string, string> = {
  sso_expired: "That sign-in link has expired or was already used. Open Kalks Trader again from the Client Area, or log in below.",
  sso_failed: "Signing in from the Client Area failed. Log in below.",
};

/**
 * Live builds: MT5-style login to a trading account (trading-engine session in an HttpOnly cookie).
 * Without an account the terminal still opens in guest chart mode.
 */
function LiveLogin() {
  const router = useRouter();
  const sp = useSearchParams();
  const [saved, setSaved] = React.useState<SavedLogin[]>([]);
  const [login, setLogin] = React.useState(sp.get("login") ?? "");
  React.useEffect(() => setSaved(readSavedLogins()), []);
  React.useEffect(() => {
    if (sp.get("logout")) toast("You have been logged out", { description: "Your workspace is kept on this device." });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const notice = sp.get("expired") ? `Your session${sp.get("login") ? ` for ${sp.get("login")}` : ""} has expired. Log in again.` : LIVE_NOTICE[sp.get("error") ?? ""];
  return (
    <div className="relative flex min-h-dvh overflow-y-auto bg-page lg:h-dvh lg:overflow-hidden">
      <Brand text="Multi-chart layouts, one-click execution, server-side SL/TP and trailing stops, depth of market and a full toolbox. Hedging, netting, cent and demo accounts." />
      <main className="relative flex flex-1 flex-col">
        <TopBar />
        <div className="relative mx-auto flex w-full max-w-[860px] flex-1 flex-col items-center justify-center gap-5 px-4 pb-10 lg:flex-row lg:items-start lg:pt-[8vh]">
          <section className="w-full max-w-[400px] rounded-[12px] border border-line bg-panel shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]" aria-label="Login to trade account">
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-center gap-2 text-[15px] font-semibold">
                <KeyRound className="size-4 text-ember" /> Login to trade account
              </div>
              <p className="mt-1 text-[12px] text-fg-3">Use the login and password of your trading account. You find them in the Client Area under Accounts.</p>
            </div>
            <div className="px-5 py-4">
              {notice && <div className="mb-3.5 rounded-[7px] border border-warn/30 bg-warn-soft px-3 py-2 text-[12px] text-warn">{notice}</div>}
              <EngineLoginForm
                initialLogin={login}
                autoFocus
                onSuccess={(r) => {
                  writeActive(r.login);
                  writeSession(null);
                  router.replace("/");
                }}
                footer={
                  <div className="flex items-center justify-between text-[11.5px] text-fg-3">
                    <a href={`${CLIENT_AREA}/accounts`} className="hover:text-fg">
                      Forgot password?
                    </a>
                    <a href={`${CLIENT_AREA}/accounts`} className="flex items-center gap-1 hover:text-fg">
                      Open an account <ArrowUpRight className="size-3" />
                    </a>
                  </div>
                }
              />
            </div>
          </section>

          <section className="w-full max-w-[400px] rounded-[12px] border border-line bg-panel lg:max-w-[340px]" aria-label="Saved logins">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-2">Saved logins</div>
              <span className="text-[11px] text-fg-3">this device</span>
            </div>
            <div className="p-1.5">
              {saved.length === 0 && <div className="px-2.5 py-3 text-[12px] text-fg-3">Logins you save appear here. Passwords are never stored.</div>}
              {saved.map((s) => (
                <div key={s.login} className={cn("group flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 transition-colors", login === s.login ? "bg-ember-soft/60" : "hover:bg-surface-2")}>
                  <button type="button" onClick={() => setLogin(s.login)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <Badge tone={s.server === "Kalks-Live" ? "ember" : "gold"} className="w-11 justify-center">
                      {s.server === "Kalks-Live" ? "live" : "demo"}
                    </Badge>
                    <span className="min-w-0">
                      <span className="block font-mono text-[12.5px] text-fg">{s.login}</span>
                      <span className="block truncate text-[11px] text-fg-3">{s.server}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Forget ${s.login}`}
                    onClick={() => {
                      const next = saved.filter((x) => x.login !== s.login);
                      setSaved(next);
                      writeSavedLogins(next);
                    }}
                    className="grid size-6 place-items-center rounded-[5px] text-fg-3 opacity-0 hover:bg-surface-3 hover:text-down focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-2.5 border-t border-line px-4 py-3">
              <p className="text-[11.5px] leading-relaxed text-fg-3">
                Coming from the Client Area? Every <span className="text-fg-2">Trade</span> button signs you in automatically, no password needed.
              </p>
              <a href={REGISTER_URL} className="flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-line bg-surface-2 text-[12.5px] font-medium text-fg transition-colors hover:bg-surface-3">
                <UserPlus className="size-4" /> Open an account
              </a>
              <button type="button" onClick={() => router.replace("/")} className="flex h-9 w-full items-center justify-center gap-2 rounded-[8px] text-[12.5px] font-medium text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg">
                <CandlestickChart className="size-4" /> Continue to charts without logging in <ArrowRight className="size-3.5" />
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Brand({ text }: { text: string }) {
  return (
    <aside className="relative hidden w-[46%] max-w-[720px] overflow-hidden border-r border-line lg:block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/photos/trading-screen.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-45" />
      <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(7,7,10,0.35),rgba(7,7,10,0.92)_62%),radial-gradient(700px_320px_at_20%_-80px,rgba(255,90,31,0.45),transparent_70%)]" />
      <div className="relative flex h-full flex-col p-10 text-white">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-[9px] border border-white/15 bg-white/10 backdrop-blur">
            <LogoMark size={16} className="text-white" />
          </span>
          <span className="text-[16px] font-semibold tracking-tight">
            <BrandName /> <span className="font-normal text-white/70">Trader</span>
          </span>
        </div>
        <div className="mt-auto max-w-[460px]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff8a3d]">Professional trading room</div>
          <h1 className="mt-3 text-[34px] font-medium leading-[1.12] tracking-tight">Every market. One workstation.</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-white/65">{text}</p>
          <div className="mt-7 grid grid-cols-2 gap-2">
            {["XAUUSD", "EURUSD", "NAS100", "BTCUSD"].map((s) => (
              <Ticker key={s} symbol={s} />
            ))}
          </div>
          <div className="mt-7 flex items-center gap-4 text-[11.5px] text-white/50">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> TLS 1.3
            </span>
            <span>Server time GMT+3</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <div className="relative flex items-center justify-between px-5 py-4 sm:px-8">
      <span className="flex items-center gap-2 lg:invisible">
        <span className="grid size-8 place-items-center rounded-[8px] border border-line-top bg-surface-3">
          <LogoMark size={14} className="text-fg" />
        </span>
        <span className="text-[14px] font-semibold">
          <BrandName /> <span className="font-normal text-fg-2">Trader</span>
        </span>
      </span>
      <div className="flex items-center gap-2">
        <a href={CLIENT_AREA} className="flex h-9 items-center gap-1 rounded-full border border-line px-3.5 text-[12.5px] text-fg-2 hover:bg-surface-3 hover:text-fg">
          Client Area <ArrowUpRight className="size-3.5" />
        </a>
        <ThemeToggle />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}>{GUEST_MODE ? <LiveLogin /> : <LoginForm />}</Suspense>;
}
