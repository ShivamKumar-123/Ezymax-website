/**
 * Back Office · Brokers (Owner) · Feature flags.
 * Import via `@ezymex/mock/admin-flags`. Exports are prefixed FLG_.
 * Extends BRK_FLAGS with environments and per-tenant rollout percentages.
 */
import { BRK_FLAGS, BRK_FLAG_EVENTS, BRK_TENANTS, type BrkFlagType } from "./admin-platform-brokers";
import type { Person } from "./people";
import { seeded } from "./rng";

export type FlgEnv = "dev" | "staging" | "prod";
export const FLG_ENVS: { key: FlgEnv; label: string }[] = [
  { key: "dev", label: "Development" },
  { key: "staging", label: "Staging" },
  { key: "prod", label: "Production" },
];

export interface FlgFlag {
  key: string;
  description: string;
  type: BrkFlagType;
  enabled: boolean;
  /** default rollout for tenants without their own value */
  rollout: number;
  envs: Record<FlgEnv, boolean>;
  /** per-tenant rollout %, 0 = off for that tenant */
  tenants: Record<string, number>;
  owner: Person;
  changedAt: string;
  createdAt: string;
  stale?: boolean;
  evaluations24h: number;
}

/** Tenants that receive flags (onboarding tenants excluded). */
export const FLG_TENANTS = BRK_TENANTS.filter((t) => t.status !== "onboarding");

export const FLG_FLAGS: FlgFlag[] = BRK_FLAGS.map((f, i) => {
  const r = seeded(8800 + i);
  const tenants: Record<string, number> = {};
  for (const t of FLG_TENANTS) {
    const ov = f.overrides[t.id];
    if (ov === true) tenants[t.id] = 100;
    else if (ov === false) tenants[t.id] = 0;
    else if (!f.enabled) tenants[t.id] = 0;
    else if (t.status === "suspended") tenants[t.id] = 0;
    else tenants[t.id] = f.rollout === 100 ? 100 : r.bool(0.7) ? f.rollout : r.pick([0, 10, 25, 50, 100]);
  }
  const envs: Record<FlgEnv, boolean> = { dev: true, staging: f.type !== "ops" || f.enabled || r.bool(0.5), prod: f.enabled };
  return {
    key: f.key,
    description: f.description,
    type: f.type,
    enabled: f.enabled,
    rollout: f.rollout,
    envs,
    tenants,
    owner: f.changedBy,
    changedAt: f.changedAt,
    createdAt: f.createdAt,
    stale: f.stale,
    evaluations24h: f.enabled ? Math.round(r.range(40_000, 2_400_000)) : Math.round(r.range(0, 4_000)),
  };
});

export const FLG_EVENTS = BRK_FLAG_EVENTS;
