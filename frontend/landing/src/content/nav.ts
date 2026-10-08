import { markets } from "./markets";
import { platformProducts } from "./platform";

export type NavLink = {
  label: string;
  href: string;
  blurb?: string;
  icon?: string;
};

export type NavGroup = {
  label: string;
  href?: string;
  links: NavLink[];
};

export const companyLinks: NavLink[] = [
  {
    label: "About",
    href: "/about",
    blurb: "What Ezymex is and how it works.",
    icon: "building",
  },
  {
    label: "Partners",
    href: "/partners",
    blurb: "Earn rebates on traders you introduce.",
    icon: "handshake",
  },
  {
    label: "FAQ",
    href: "/faq",
    blurb: "Access, margin, cover and withdrawals.",
    icon: "message",
  },
  {
    label: "Contact",
    href: "/contact",
    blurb: "Reach support.",
    icon: "mail",
  },
];

/**
 * Six slots, same shape as the design was built for. The axis changed: a
 * vendor's Solutions / Products / Liquidity / Pricing / Services became a
 * trader's Markets / Platform / Protection / Earn.
 *
 * Pricing is deliberately absent. Ezymex publishes no retail spread or
 * commission schedule anywhere in the backend, so a pricing page could only
 * be filled with invented numbers. The one real price list it has — the
 * Shield plans — lives on /protection.
 */
export const mainNav: NavGroup[] = [
  {
    label: "Markets",
    href: "/markets",
    links: markets.map((m) => ({
      label: m.nav.label,
      href: `/markets/${m.slug}`,
      blurb: m.nav.blurb,
      icon: m.nav.icon,
    })),
  },
  {
    label: "Platform",
    href: "/platform",
    links: platformProducts.map((p) => ({
      label: p.nav.label,
      href: `/platform/${p.slug}`,
      blurb: p.nav.blurb,
      icon: p.nav.icon,
    })),
  },
  { label: "Protection", href: "/protection", links: [] },
  { label: "Earn", href: "/earn", links: [] },
  { label: "Company", links: companyLinks },
];

export const footerColumns: { heading: string; links: NavLink[] }[] = [
  {
    heading: "Markets",
    links: markets.map((m) => ({
      label: m.nav.label,
      href: `/markets/${m.slug}`,
    })),
  },
  {
    heading: "Platform",
    links: platformProducts.map((p) => ({
      label: p.nav.label,
      href: `/platform/${p.slug}`,
    })),
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Protection", href: "/protection" },
      { label: "Earn", href: "/earn" },
      { label: "Partners", href: "/partners" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export const legalLinks: NavLink[] = [
  { label: "Privacy Policy", href: "/legal/privacy-policy" },
  { label: "Terms of Service", href: "/legal/terms-of-service" },
  { label: "Risk Disclosure", href: "/legal/risk-disclosure" },
];
