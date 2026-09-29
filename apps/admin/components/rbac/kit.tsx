"use client";

/**
 * Shared bits for the live staff / roles / security / settings / owner pages (gateway RBAC, D108–D113, D122).
 */
import * as React from "react";
import { toast } from "sonner";
import type { ChipTone } from "@kalks/ui";
import type { ApiErr } from "@/components/live/kit";

export type Method = "POST" | "PATCH" | "PUT" | "DELETE";

function expired() {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/api/auth/expired?next=${encodeURIComponent(next)}`);
}

/** JSON mutation against a same-origin BFF (every method carries a JSON body for the CSRF check). */
export async function call<T = Record<string, unknown>>(method: Method, url: string, body: unknown = {}): Promise<{ ok: true; data: T } | { ok: false; error: ApiErr }> {
  try {
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}), credentials: "same-origin" });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) {
      expired();
      return { ok: false, error: { code: "unauthorized", message: "Your session has ended." } };
    }
    if (r.ok) return { ok: true, data: data as T };
    return { ok: false, error: data?.error ?? { code: "unknown", message: "Something went wrong." } };
  } catch {
    return { ok: false, error: { code: "network", message: "Can't reach the Back Office server." } };
  }
}

/** `call` + toast; returns the data or null. */
export async function act<T = Record<string, unknown>>(method: Method, url: string, body: unknown, success?: string, description?: string): Promise<T | null> {
  const r = await call<T>(method, url, body);
  if (!r.ok) {
    toast.error(r.error.message);
    return null;
  }
  if (success) toast.success(success, description ? { description } : undefined);
  return r.data;
}

export function useBusy() {
  const [busy, setBusy] = React.useState<string | null>(null);
  const run = React.useCallback(async <T,>(key: string, fn: () => Promise<T>) => {
    setBusy(key);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  }, []);
  return { busy, run };
}

/** "$12,500.00" from cents. */
export function money(cents: number | null | undefined, currency = "USD") {
  const v = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency === "USDT" ? "USD" : currency, maximumFractionDigits: 2 }).format(v) + (currency === "USDT" ? " T" : "");
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

export const pct = (bps: number | null | undefined) => `${((bps ?? 0) / 100).toFixed(2).replace(/\.00$/, "")}%`;

export const STATUS_TONE: Record<string, ChipTone> = {
  active: "up",
  invited: "warn",
  disabled: "down",
  suspended: "down",
  draft: "neutral",
  issued: "info",
  paid: "up",
  overdue: "down",
  void: "neutral",
  up: "up",
  degraded: "warn",
  down: "down",
};

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type Catalogue = {
  modules: { key: string; label: string; description: string }[];
  permissions: { key: string; module: string; action: "view" | "create" | "edit" | "approve" | "export"; label: string }[];
  actions: string[];
};

export type Role = {
  id: number;
  key: string;
  name: string;
  description: string;
  kind: "system" | "preset" | "custom";
  customised: boolean;
  permissions: string[];
  members: number;
  service_role: string;
  editable: boolean;
  assignable: boolean;
  updated_at: string;
};

export type RolesResp = { items: Role[]; catalogue: Catalogue; my_permissions: string[] };

/** Short human label for a permission key, from the catalogue. */
export function permLabel(cat: Catalogue | undefined, key: string) {
  return cat?.permissions.find((p) => p.key === key)?.label ?? key;
}

export function InviteLink({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <div className="mt-3 rounded-[14px] border border-dashed border-line px-4 py-3 text-[12.5px] text-fg-3">
      Dev mode: email isn&apos;t configured, so send this link yourself:
      <div className="mt-1.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg" data-testid="invite-url">
          {url}
        </code>
        <button
          type="button"
          className="shrink-0 text-ember hover:underline"
          onClick={() => {
            void navigator.clipboard?.writeText(url);
            toast.success("Invite link copied");
          }}
        >
          Copy
        </button>
      </div>
    </div>
  );
}

/** Native select styled like the kit's inputs. */
export function Select({ value, onChange, children, className, ...rest }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & { onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={"h-11 w-full rounded-[14px] border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-ember/50 " + (className ?? "")}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={"min-h-24 w-full rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 text-sm text-fg outline-none placeholder:text-fg-3 focus:border-ember/50 " + (props.className ?? "")} />;
}
