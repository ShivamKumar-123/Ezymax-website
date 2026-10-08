import { solutions } from "./solutions";
import { products } from "./products";

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
  { label: "About", href: "/about", blurb: "Who we are and why we started SetupZero.", icon: "building" },
  { label: "Careers", href: "/careers", blurb: "Join a fast-growing fintech team.", icon: "briefcase" },
  { label: "Partners", href: "/partners", blurb: "Referral, technology and reseller programs.", icon: "handshake" },
  { label: "Blog", href: "/blog", blurb: "Insights for brokers and prop firms.", icon: "filetext" },
  { label: "FAQ", href: "/faq", blurb: "Answers to the questions we hear most.", icon: "message" },
  { label: "Contact", href: "/contact", blurb: "Talk to sales or support.", icon: "mail" },
];

export const mainNav: NavGroup[] = [
  {
    label: "Solutions",
    href: "/solutions",
    links: solutions.map((s) => ({
      label: s.nav.label,
      href: `/solutions/${s.slug}`,
      blurb: s.nav.blurb,
      icon: s.nav.icon,
    })),
  },
  {
    label: "Products",
    href: "/products",
    links: products.map((p) => ({
      label: p.nav.label,
      href: `/products/${p.slug}`,
      blurb: p.nav.blurb,
      icon: p.nav.icon,
    })),
  },
  { label: "Liquidity", href: "/liquidity", links: [] },
  { label: "Pricing", href: "/pricing", links: [] },
  { label: "Services", href: "/services", links: [] },
  { label: "Company", links: companyLinks },
];

export const footerColumns: { heading: string; links: NavLink[] }[] = [
  {
    heading: "Solutions",
    links: solutions.map((s) => ({ label: s.nav.label, href: `/solutions/${s.slug}` })),
  },
  {
    heading: "Products",
    links: products
      .filter((p) => p.slug !== "payment-integrations")
      .map((p) => ({
        label: p.slug === "ib-affiliate-module" ? "IB Module" : p.nav.label,
        href: `/products/${p.slug}`,
      })),
  },
  {
    heading: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Pricing", href: "/pricing" },
      { label: "Support & Services", href: "/services" },
      { label: "Partners", href: "/partners" },
      { label: "Careers", href: "/careers" },
      { label: "Blog", href: "/blog" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export const legalLinks: NavLink[] = [
  { label: "Privacy Policy", href: "/legal/privacy-policy" },
  { label: "Terms of Use", href: "/legal/terms-of-use" },
  { label: "Cookie Policy", href: "/legal/cookie-policy" },
  { label: "Disclaimer", href: "/legal/disclaimer" },
];
