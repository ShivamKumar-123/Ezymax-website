/**
 * Back Office · Marketing · UTM campaigns with realistic broker unit economics
 * (CPA $150–600). Derived from MKT_CAMPAIGNS; import via `@kalks/mock/admin-campaigns`. Prefix: UTM_.
 */
import { MKT_CAMPAIGNS, MKT_SPEND_REVENUE, MKT_UTM_MEDIUMS, MKT_UTM_SOURCES, type MktCampaign } from "./admin-growth-marketing";
import { seeded } from "./rng";

export type UtmCampaign = MktCampaign;

export const UTM_CAMPAIGNS: UtmCampaign[] = MKT_CAMPAIGNS.map((c, i) => {
  const r = seeded(9100 + i);
  const signups = Math.round(c.signups * r.range(0.55, 0.7));
  const kyc = Math.round(signups * r.range(0.38, 0.52));
  const ftds = Math.max(4, Math.round(kyc * r.range(0.16, 0.28)));
  const avgFtd = c.ftdAmount / Math.max(1, c.ftds);
  const ftdAmount = Math.round(ftds * avgFtd);
  const active = Math.round(ftds * r.range(0.55, 0.78));
  return { ...c, signups, kyc, ftds, ftdAmount, active };
});

export const UTM_SPEND_REVENUE = MKT_SPEND_REVENUE;
export const UTM_SOURCES = MKT_UTM_SOURCES;
export const UTM_MEDIUMS = MKT_UTM_MEDIUMS;
