import { site } from "./site";

/**
 * /contact.
 *
 * One channel, not three. The template split sales, support and partnerships
 * for a company with a sales team; Ezymex has a support mailbox. The Dubai
 * headquarters line is gone — it belonged to the other company, and no
 * confirmed address has replaced it.
 */
export const contactPage = {
  eyebrow: "Contact",
  headline: "Talk to Support",
  highlight: "Support",
  sub: "Questions about access, your account or the platform. For anything about risk or complaints, the legal documents list the dedicated addresses.",
  channels: [
    {
      title: "Support",
      body: `Account, access and platform questions — ${site.email}. We reply within one business day.`,
      icon: "headphones",
    },
    {
      title: "Partners",
      body: "Introducing traders, rebate tiers and partner reporting.",
      icon: "handshake",
    },
  ],
};
