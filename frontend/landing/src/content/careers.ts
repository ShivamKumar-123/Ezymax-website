import type { Feature } from "./schema";

export const careersPage = {
  eyebrow: "Careers",
  headline: "Build the Future of Trading Technology With Us",
  highlight: "Trading Technology",
  sub: "We are a fast-growing team of engineers, product specialists and support experts. If you love fintech and want to make an impact, we want to hear from you.",
  whyHeading: "Why join SetupZero",
  why: [
    { title: "Real products, real users", body: "Work on real products used by brokers worldwide.", icon: "globe" },
    { title: "Flexible and hybrid work", body: "Flexible and hybrid work options.", icon: "calendar" },
    { title: "Learning and growth", body: "Learning budget and career growth.", icon: "trending" },
    { title: "Competitive pay", body: "Competitive salary and performance bonuses.", icon: "award" },
  ] as Feature[],
  rolesHeading: "Open roles",
  rolesNote: "Open positions will be listed here. Until then, send us your CV for any of the roles below.",
  roles: [
    { title: "Backend Developer", team: "Engineering", location: "Dubai / Hybrid" },
    { title: "Support Engineer", team: "Technical Support", location: "Dubai / Remote" },
    { title: "Sales Manager", team: "Sales", location: "Dubai" },
    { title: "Business Development Executive", team: "Growth", location: "Dubai / Remote" },
  ],
  formHeading: "Send Your CV",
  formSub: "Tell us which role interests you and attach a link to your CV or portfolio.",
};
