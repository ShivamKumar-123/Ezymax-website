import type { LegalDoc } from "./schema";

const reviewNote =
  "Draft for review. This text is a placeholder structure and must be reviewed and approved by legal counsel under UAE law before launch.";

export const legalDocs: LegalDoc[] = [
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    updated: "2026-10-07",
    intro: reviewNote,
    sections: [
      {
        heading: "What we collect",
        paragraphs: [
          "When you contact us, book a demo, subscribe to our newsletter or apply for a role, we collect the details you provide, such as your name, company, email address, phone number and message.",
          "We also collect standard technical information when you visit this website, including IP address, browser type, pages visited and referring URLs, through server logs and analytics tools.",
        ],
      },
      {
        heading: "How we use it",
        paragraphs: [
          "To respond to enquiries, prepare proposals and quotes, deliver services under a contract, send newsletter content you have asked for, and improve this website.",
          "We do not sell personal data. We share it only with service providers who help us operate the website and our business, and where required by law.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You can ask us to access, correct or delete the personal data we hold about you, or to stop sending you marketing communications, by contacting us through the Contact page.",
        ],
      },
    ],
  },
  {
    slug: "terms-of-use",
    title: "Terms of Use",
    updated: "2026-10-07",
    intro: reviewNote,
    sections: [
      {
        heading: "Use of this website",
        paragraphs: [
          "This website is operated by SetupZero. By using it you agree to these terms. Content is provided for general information about our technology products and services and does not form part of any contract.",
        ],
      },
      {
        heading: "No financial services",
        paragraphs: [
          "SetupZero is a technology provider. Nothing on this website is investment advice, a solicitation to trade, or an offer of financial services. Liquidity and financial services referred to on this website are provided by independent, licensed third parties.",
        ],
      },
      {
        heading: "Intellectual property",
        paragraphs: [
          "All trademarks, logos, text, design and software on this website belong to SetupZero or its licensors and may not be reproduced without written permission.",
        ],
      },
    ],
  },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    updated: "2026-10-07",
    intro: reviewNote,
    sections: [
      {
        heading: "What cookies we use",
        paragraphs: [
          "Strictly necessary cookies that make the website work, and analytics cookies that help us understand how visitors use the site so we can improve it.",
        ],
      },
      {
        heading: "Managing cookies",
        paragraphs: [
          "You can control or delete cookies through your browser settings. Blocking some cookies may affect how parts of the website work.",
        ],
      },
    ],
  },
  {
    slug: "disclaimer",
    title: "Disclaimer",
    updated: "2026-10-07",
    intro: reviewNote,
    sections: [
      {
        heading: "Technology provider only",
        paragraphs: [
          "SetupZero provides technology solutions only. SetupZero is not a broker, does not provide investment advice and does not hold client funds.",
          "Liquidity and financial services are provided by independent, licensed third parties. SetupZero does not act as a counterparty to trades.",
        ],
      },
      {
        heading: "Licensing",
        paragraphs: [
          "Clients are responsible for obtaining any licences required in their jurisdiction. SetupZero can introduce clients to legal partners but does not provide legal or licensing advice.",
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string) {
  return legalDocs.find((d) => d.slug === slug);
}
