import type { Feature } from "./schema";
import { placeholders } from "./placeholders";

export const servicesPage = {
  eyebrow: "Support & Services",
  headline: "Technical Support That Never Sleeps",
  highlight: "Never Sleeps",
  sub: "Our experts keep your brokerage running smoothly 24/7, so you can focus on growth.",
  servicesHeading: "Services",
  services: [
    {
      title: "24/7 technical support",
      body: "Help with platform issues, server monitoring and incident response.",
      icon: "headphones",
    },
    {
      title: "Platform administration",
      body: "We manage symbols, groups, spreads, swaps and server settings for you.",
      icon: "settings",
    },
    {
      title: "Dealing desk support",
      body: "Outsourced monitoring of exposure, execution and risk alerts.",
      icon: "eye",
    },
    {
      title: "Server hosting & maintenance",
      body: "Secure, monitored hosting with backups and disaster recovery.",
      icon: "server",
    },
    {
      title: "Integrations",
      body: "Connect payment providers, KYC providers, liquidity providers and marketing tools.",
      icon: "plug",
    },
    {
      title: "Migration services",
      body: "Move clients, accounts and history from your old provider with minimal downtime.",
      icon: "migrate",
    },
    {
      title: "Website & branding",
      body: "Broker websites, landing pages and brand design.",
      icon: "paintbrush",
    },
    {
      title: "Consulting",
      body: "Business model, licensing partner introductions and go-to-market planning.",
      icon: "lightbulb",
    },
  ] as Feature[],
  channelsHeading: "Support channels",
  channels: [
    { label: "Live chat", icon: "message" },
    { label: "Email", icon: "mail" },
    { label: "Telegram / WhatsApp", icon: "smartphone" },
    { label: "Ticket system", icon: "clipboard" },
    { label: "Dedicated account manager", icon: "users", note: "Growth and Enterprise" },
  ],
  promiseHeading: "Our support promise",
  promise: [
    {
      title: `First response within ${placeholders.criticalFirstResponseMinutes} minutes`,
      body: "For critical issues.",
      icon: "zap",
    },
    {
      title: "Proactive monitoring",
      body: "So we often fix issues before you notice.",
      icon: "bell",
    },
    {
      title: "Clear escalation path",
      body: "Straight to senior engineers when it matters.",
      icon: "trending",
    },
  ] as Feature[],
  cta: {
    heading: "Get support for your brokerage",
    sub: "Tell us what you run today and we will propose the right support and services plan.",
    ctas: [
      { label: "Get Support for Your Brokerage", action: "demo" as const },
      { label: "View Pricing", href: "/pricing", variant: "outline" as const },
    ],
  },
};
