import type { Feature, Stat } from "./schema";
import { placeholders } from "./placeholders";

export const aboutPage = {
  eyebrow: "About SetupZero",
  headline: "We Build the Technology. You Build the Brokerage.",
  highlight: "You Build the Brokerage.",
  sub: "SetupZero brings platform, CRM, risk, liquidity connectivity and support under one roof, so founders can focus on clients and growth.",
  storyHeading: "Our story",
  story: [
    `SetupZero was founded by a team with 5 years of hands-on experience in brokerage technology, trading infrastructure and fintech support. Before SetupZero, our team delivered platform setups, CRM integrations and technical support to brokers across ${placeholders.regionsBefore} under the SetupFX brand.`,
    "We saw the same problem again and again: launching a brokerage meant juggling five or six vendors, long timelines and costs that kept growing. SetupZero brings everything under one roof, so founders can focus on clients and growth instead of technology headaches.",
    "Headquartered in Dubai, we serve brokers, prop firms and fintech companies across the Middle East, Asia, Africa, Europe and Latin America.",
  ],
  mission: {
    heading: "Mission",
    body: "To make launching and running a brokerage simple, fast and affordable for every ambitious founder.",
  },
  vision: {
    heading: "Vision",
    body: "To become the most trusted end-to-end technology partner for the global trading industry.",
  },
  valuesHeading: "Our values",
  values: [
    { title: "Client first", body: "Your success is how we measure ours.", icon: "heart" },
    { title: "Transparency", body: "Clear pricing, clear timelines, clear communication.", icon: "eye" },
    { title: "Reliability", body: "Stable systems and support that answers when you need it.", icon: "shield" },
    { title: "Innovation", body: "We keep improving our products as the market changes.", icon: "lightbulb" },
    { title: "Ownership", body: "We treat every client project as our own.", icon: "target" },
  ] as Feature[],
  numbersHeading: "Numbers",
  numbers: [
    { value: placeholders.experienceYears, label: "Years of industry experience" },
    { value: placeholders.projectsDelivered, label: "Projects delivered" },
    { value: placeholders.teamMembers, label: "Team members" },
    { value: placeholders.countries, label: "Countries with clients" },
  ] as Stat[],
  teamHeading: "The People Behind SetupZero",
  teamNote: "Photos, names and roles for founders and key leaders will be added here.",
  team: [
    { name: "Founder", role: "Chief Executive Officer" },
    { name: "Co-founder", role: "Chief Technology Officer" },
    { name: "Leader", role: "Head of Client Success" },
    { name: "Leader", role: "Head of Trading Infrastructure" },
  ],
  cta: {
    heading: "Want to work with us?",
    sub: "Book a demo or explore careers.",
    ctas: [
      { label: "Book a Free Demo", action: "demo" as const },
      { label: "Explore Careers", href: "/careers", variant: "outline" as const },
    ],
  },
};
