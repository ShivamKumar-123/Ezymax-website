"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Chip, cn } from "@kalks/ui";
import { ORG_DESKS, ORG_ROLE_META, type OrgDeskKey, type OrgRoleKey, type OrgTwoFa } from "@kalks/mock/admin-platform-security";

export function RoleChip({ role, size = "sm" }: { role: OrgRoleKey; size?: "sm" | "md" }) {
  const m = ORG_ROLE_META[role];
  return (
    <Chip size={size} tone={m.tone}>
      {m.name}
    </Chip>
  );
}

export function deskName(k: OrgDeskKey | null) {
  return k ? (ORG_DESKS.find((d) => d.key === k)?.name ?? k) : "Management";
}

export const TWOFA_LABEL: Record<OrgTwoFa, string> = { hardware: "Security key", totp: "Authenticator", sms: "SMS", none: "Not set" };

/** Selectable pill used in dialogs (roles, desks, tenants). */
export function PickPill({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
        on ? "border-ember/40 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
        className,
      )}
    >
      {on && <Check className="size-3.5 text-ember" />}
      {children}
    </button>
  );
}

/** Avatar stack from photo URLs. */
export function AvatarStack({ photos, max = 5, size = 28 }: { photos: { src: string; name: string }[]; max?: number; size?: number }) {
  const shown = photos.slice(0, max);
  const extra = photos.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p.src + p.name} src={p.src} alt={p.name} title={p.name} className="rounded-full object-cover ring-2 ring-surface" style={{ width: size, height: size }} />
      ))}
      {extra > 0 && (
        <span className="k-num grid place-items-center rounded-full bg-surface-3 text-[10.5px] font-medium text-fg-2 ring-2 ring-surface" style={{ width: size, height: size }}>
          +{extra}
        </span>
      )}
    </div>
  );
}
