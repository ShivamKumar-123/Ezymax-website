import type { ArticleMeta } from "./schema";

export const blogPage = {
  eyebrow: "Blog",
  headline: "Insights for Brokers and Prop Firms",
  highlight: "Brokers and Prop Firms",
  sub: "Practical guides on starting a brokerage, running a prop firm, trading technology, liquidity and regulation.",
};

export const blogCategories = [
  "Starting a Brokerage",
  "Prop Firm Business",
  "Trading Technology",
  "Liquidity & Risk",
  "Regulation Updates",
  "Company News",
] as const;

export const articles: ArticleMeta[] = [
  {
    slug: "how-to-start-a-forex-brokerage-2026",
    title: "How to Start a Forex Brokerage in 2026: Step-by-Step Guide",
    category: "Starting a Brokerage",
    excerpt:
      "From business model and licensing partners to platform, CRM and liquidity: the steps that take a brokerage from idea to first live trade.",
    date: "2026-10-01",
    readingTime: "9 min read",
  },
  {
    slug: "white-label-vs-own-platform",
    title: "White Label vs Own Platform: Which Is Right for You?",
    category: "Trading Technology",
    excerpt:
      "Cost, speed, control and long-term flexibility. How to decide between a white-label platform and building your own.",
    date: "2026-09-24",
    readingTime: "7 min read",
  },
  {
    slug: "how-to-launch-a-prop-firm",
    title: "How to Launch a Prop Firm: Technology, Rules and Payouts",
    category: "Prop Firm Business",
    excerpt:
      "Challenge design, automated rule checks, payout logic and the technology stack behind a prop firm that scales.",
    date: "2026-09-17",
    readingTime: "8 min read",
  },
  {
    slug: "a-book-vs-b-book-vs-hybrid",
    title: "A-Book vs B-Book vs Hybrid: Choosing Your Execution Model",
    category: "Liquidity & Risk",
    excerpt:
      "What each execution model means for risk, revenue and client experience, and how brokers combine them in practice.",
    date: "2026-09-10",
    readingTime: "6 min read",
  },
  {
    slug: "what-to-look-for-in-a-forex-crm",
    title: "What to Look for in a Forex CRM",
    category: "Trading Technology",
    excerpt:
      "Lead pipelines, KYC workflows, approvals, reporting and compliance: the checklist for evaluating a brokerage CRM.",
    date: "2026-09-03",
    readingTime: "6 min read",
  },
  {
    slug: "how-much-does-it-cost-to-start-a-brokerage",
    title: "How Much Does It Cost to Start a Brokerage?",
    category: "Starting a Brokerage",
    excerpt:
      "A breakdown of one-off and recurring costs, from technology and hosting to licensing partners, payments and support.",
    date: "2026-08-27",
    readingTime: "7 min read",
  },
];

export function getArticle(slug: string) {
  return articles.find((a) => a.slug === slug);
}
