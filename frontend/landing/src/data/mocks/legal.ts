/**
 * Legal documents — Privacy Policy, Terms of Service, Risk Disclosure.
 *
 * Content lives here (data layer) so the `LegalDocument` component stays
 * purely presentational (AGENTS.md rule 4). Privacy + Risk are carried over
 * from the platform's existing legal copy; Terms is authored to match.
 */

export type LegalBlock =
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "callout"; title: string; text: string }
  | { kind: "contact"; team: string; email: string; phone: string; address: string };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}

const CONTACT_PHONE = "+1 (908) 228-0305";
const CONTACT_ADDRESS =
  "Office 9364hn, 3 Fitzroy Place, Glasgow City Centre, UK, G3 7RH";

const contact = (team: string, email: string): LegalBlock => ({
  kind: "contact",
  team,
  email,
  phone: CONTACT_PHONE,
  address: CONTACT_ADDRESS,
});

// ── Privacy Policy ────────────────────────────────────────────────
export const privacyDoc: LegalDoc = {
  eyebrow: "Legal",
  title: "Privacy Policy",
  intro:
    "How FX Artha collects, uses, and safeguards your information when you visit our website and use our trading platform.",
  updated: "Last updated: March 2026",
  sections: [
    {
      heading: "1. Introduction",
      blocks: [
        {
          kind: "text",
          text: 'FX Artha ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our trading platform.',
        },
      ],
    },
    {
      heading: "2. Information We Collect",
      blocks: [
        { kind: "text", text: "We collect information you provide directly, including:" },
        {
          kind: "list",
          items: [
            "Full name, email address, and phone number",
            "Date of birth and identification documents",
            "Address and residency information",
            "Banking and payment information",
            "Trading preferences and account settings",
          ],
        },
        { kind: "text", text: "When you use our platform, we automatically collect:" },
        {
          kind: "list",
          items: [
            "IP address and device information",
            "Browser type and operating system",
            "Pages visited and time spent on pages",
            "Trading activity and transaction history",
            "Cookies and similar tracking technologies",
          ],
        },
      ],
    },
    {
      heading: "3. How We Use Your Information",
      blocks: [
        { kind: "text", text: "We use the information we collect for the following purposes:" },
        {
          kind: "list",
          items: [
            "To provide, maintain, and improve our trading platform",
            "To process your deposits, withdrawals, and trades",
            "To verify your identity and comply with KYC/AML regulations",
            "To communicate with you about your account and services",
            "To send promotional emails and marketing communications",
            "To detect and prevent fraud and unauthorized access",
            "To comply with legal obligations and regulatory requirements",
            "To analyze platform usage and improve user experience",
          ],
        },
      ],
    },
    {
      heading: "4. Data Security",
      blocks: [
        {
          kind: "text",
          text: "We implement industry-standard security measures to protect your personal information, including:",
        },
        {
          kind: "list",
          items: [
            "SSL/TLS encryption for all data in transit",
            "AES-256 encryption for sensitive data at rest",
            "Regular security audits and penetration testing",
            "Segregated client funds in separate bank accounts",
            "Multi-factor authentication for account access",
            "Restricted access to personal information by authorized personnel only",
          ],
        },
        {
          kind: "text",
          text: "However, no method of transmission over the Internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.",
        },
      ],
    },
    {
      heading: "5. Information Sharing",
      blocks: [
        { kind: "text", text: "We may share your information with:" },
        {
          kind: "list",
          items: [
            "Payment processors and financial institutions",
            "Regulatory authorities and government agencies",
            "Third-party service providers (hosting, analytics, customer support)",
            "Legal advisors and compliance consultants",
            "Fraud prevention and identity verification services",
          ],
        },
        {
          kind: "text",
          text: "We do not sell your personal information to third parties for marketing purposes.",
        },
      ],
    },
    {
      heading: "6. Your Rights",
      blocks: [
        { kind: "text", text: "You have the right to:" },
        {
          kind: "list",
          items: [
            "Access your personal information",
            "Correct inaccurate or incomplete information",
            "Request deletion of your information (subject to legal requirements)",
            "Opt-out of marketing communications",
            "Request a copy of your data in a portable format",
            "Lodge a complaint with regulatory authorities",
          ],
        },
      ],
    },
    {
      heading: "7. Cookies and Tracking",
      blocks: [
        {
          kind: "text",
          text: "We use cookies and similar technologies to enhance your experience. You can control cookie settings through your browser preferences. Disabling cookies may affect platform functionality.",
        },
      ],
    },
    {
      heading: "8. Data Retention",
      blocks: [
        {
          kind: "text",
          text: "We retain your personal information for as long as necessary to provide our services and comply with legal obligations. Trading records are retained for a minimum of 7 years as required by financial regulations.",
        },
      ],
    },
    {
      heading: "9. Contact Us",
      blocks: [
        {
          kind: "text",
          text: "If you have questions about this Privacy Policy or our privacy practices, please contact us:",
        },
        contact("Privacy Team", "privacy@fxartha.com"),
      ],
    },
  ],
};

// ── Terms of Service ──────────────────────────────────────────────
export const termsDoc: LegalDoc = {
  eyebrow: "Legal",
  title: "Terms of Service",
  intro:
    "The agreement governing your access to and use of the FX Artha website, trading platform, and related services.",
  updated: "Last updated: March 2026",
  sections: [
    {
      heading: "1. Acceptance of Terms",
      blocks: [
        {
          kind: "text",
          text: 'By accessing or using the FX Artha website, trading platform, or any related services (collectively, the "Services"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use the Services.',
        },
      ],
    },
    {
      heading: "2. Eligibility",
      blocks: [
        { kind: "text", text: "To open an account and use the Services, you must:" },
        {
          kind: "list",
          items: [
            "Be at least 18 years of age (or the age of majority in your jurisdiction)",
            "Have the legal capacity to enter into a binding agreement",
            "Not be a resident of any jurisdiction where use of the Services is prohibited",
            "Not be subject to any sanctions or listed on any restricted-persons register",
          ],
        },
      ],
    },
    {
      heading: "3. Account Registration",
      blocks: [
        {
          kind: "text",
          text: "You agree to provide accurate, current, and complete information during registration and to keep it up to date. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately of any unauthorized access.",
        },
      ],
    },
    {
      heading: "4. The Services",
      blocks: [
        {
          kind: "text",
          text: "FX Artha provides an online platform for trading foreign exchange, cryptocurrencies, and other leveraged instruments. We may add, modify, suspend, or discontinue any part of the Services at any time. We do not provide investment, tax, or legal advice; nothing on the platform constitutes a recommendation to trade.",
        },
      ],
    },
    {
      heading: "5. Risk Acknowledgment",
      blocks: [
        {
          kind: "callout",
          title: "Trading involves substantial risk",
          text: "Leveraged trading can result in losses that exceed your deposit. You confirm that you have read and understood our Risk Disclosure and that you trade at your own risk.",
        },
      ],
    },
    {
      heading: "6. Deposits and Withdrawals",
      blocks: [
        {
          kind: "text",
          text: "Deposits and withdrawals are processed in accordance with our funding policies and applicable KYC/AML requirements. We may request additional verification before processing a withdrawal. Client funds are held in segregated accounts separate from company operating funds.",
        },
      ],
    },
    {
      heading: "7. Fees and Charges",
      blocks: [
        { kind: "text", text: "Your use of the Services may be subject to:" },
        {
          kind: "list",
          items: [
            "Spreads and commissions on trades",
            "Overnight financing (swap) charges on open positions",
            "Deposit and withdrawal processing fees where applicable",
            "Inactivity fees on dormant accounts",
          ],
        },
        {
          kind: "text",
          text: "Applicable fees are disclosed on the platform and may be updated from time to time.",
        },
      ],
    },
    {
      heading: "8. Prohibited Conduct",
      blocks: [
        { kind: "text", text: "You agree not to:" },
        {
          kind: "list",
          items: [
            "Use the Services for any unlawful purpose, including money laundering or fraud",
            "Engage in market manipulation, arbitrage abuse, or latency exploitation",
            "Access the Services through automated means without our written consent",
            "Attempt to interfere with, compromise, or reverse-engineer the platform",
            "Provide false information or open accounts on behalf of third parties",
          ],
        },
      ],
    },
    {
      heading: "9. Intellectual Property",
      blocks: [
        {
          kind: "text",
          text: "All content, trademarks, software, and materials on the platform are the property of FX Artha or its licensors and are protected by intellectual-property laws. You may not copy, reproduce, or distribute any part of the Services without prior written permission.",
        },
      ],
    },
    {
      heading: "10. Limitation of Liability",
      blocks: [
        {
          kind: "text",
          text: "To the maximum extent permitted by law, FX Artha shall not be liable for any indirect, incidental, or consequential losses, including trading losses, arising from your use of the Services, technical failures, or market conditions. Our aggregate liability shall not exceed the fees you paid to us in the preceding twelve months.",
        },
      ],
    },
    {
      heading: "11. Termination",
      blocks: [
        {
          kind: "text",
          text: "We may suspend or terminate your account at our discretion, including for breach of these Terms, suspected fraud, or regulatory requirements. You may close your account at any time, subject to the settlement of open positions and outstanding obligations.",
        },
      ],
    },
    {
      heading: "12. Amendments and Governing Law",
      blocks: [
        {
          kind: "text",
          text: "We may amend these Terms from time to time; continued use of the Services after changes take effect constitutes acceptance. These Terms are governed by the laws of the jurisdiction in which FX Artha is established, without regard to conflict-of-law principles.",
        },
      ],
    },
    {
      heading: "13. Contact Us",
      blocks: [
        {
          kind: "text",
          text: "For questions about these Terms of Service, please contact:",
        },
        contact("Legal Team", "legal@fxartha.com"),
      ],
    },
  ],
};

// ── Risk Disclosure ───────────────────────────────────────────────
export const riskDoc: LegalDoc = {
  eyebrow: "Legal",
  title: "Risk Disclosure",
  intro:
    "Trading leveraged instruments carries a high level of risk. Please read this disclosure carefully before opening an account.",
  updated: "Last updated: March 2026",
  sections: [
    {
      heading: "Important Risk Warning",
      blocks: [
        {
          kind: "callout",
          title: "You may lose your invested capital",
          text: "Trading foreign exchange, cryptocurrencies, and other leveraged instruments carries a high level of risk and may not be suitable for all investors. You may lose some or all of your invested capital. Past performance is not indicative of future results.",
        },
      ],
    },
    {
      heading: "1. Leverage Risk",
      blocks: [
        {
          kind: "text",
          text: "FX Artha offers leverage up to 1:500 on certain instruments. Leverage amplifies both gains and losses. A small adverse price movement can result in substantial losses or even the complete loss of your deposit.",
        },
        {
          kind: "callout",
          title: "Example",
          text: "With 1:100 leverage, a 1% adverse price movement results in a 100% loss of your margin.",
        },
      ],
    },
    {
      heading: "2. Market Risk",
      blocks: [
        { kind: "text", text: "Financial markets are volatile and unpredictable. Prices can move rapidly due to:" },
        {
          kind: "list",
          items: [
            "Economic data releases and central bank announcements",
            "Geopolitical events and political instability",
            "Market sentiment shifts and investor behavior",
            "Supply and demand imbalances",
            "Regulatory changes and policy decisions",
            "Cryptocurrency volatility and technological changes",
          ],
        },
      ],
    },
    {
      heading: "3. Liquidity Risk",
      blocks: [
        {
          kind: "text",
          text: "While major currency pairs are highly liquid, some instruments may have limited liquidity. During periods of low liquidity, you may experience:",
        },
        {
          kind: "list",
          items: [
            "Wider bid-ask spreads",
            "Slippage on order execution",
            "Difficulty closing positions at desired prices",
            "Increased trading costs",
          ],
        },
      ],
    },
    {
      heading: "4. Counterparty Risk",
      blocks: [
        {
          kind: "text",
          text: "Your trades are executed through FX Artha's liquidity providers. If a liquidity provider defaults or experiences financial difficulties, your funds may be at risk despite our segregated account structure.",
        },
      ],
    },
    {
      heading: "5. Technology Risk",
      blocks: [
        { kind: "text", text: "Trading platforms are subject to technical failures, including:" },
        {
          kind: "list",
          items: [
            "Server outages and connectivity issues",
            "Platform bugs and software errors",
            "Cyber attacks and security breaches",
            "Internet connection failures on your end",
            "Mobile app crashes and malfunctions",
          ],
        },
        {
          kind: "text",
          text: "While we maintain redundant systems and backups, we cannot guarantee 100% uptime. Trading during periods of technical difficulty may result in losses.",
        },
      ],
    },
    {
      heading: "6. Cryptocurrency Risk",
      blocks: [
        { kind: "text", text: "Cryptocurrency trading carries additional risks:" },
        {
          kind: "list",
          items: [
            "Extreme price volatility (50%+ daily moves are possible)",
            "Regulatory uncertainty and potential bans",
            "Wallet and exchange security risks",
            "Blockchain network congestion and delays",
            "Limited historical data and price discovery",
            "Potential for total loss of investment",
          ],
        },
      ],
    },
    {
      heading: "7. Operational Risk",
      blocks: [
        { kind: "text", text: "Risks related to our operations include:" },
        {
          kind: "list",
          items: [
            "Human error in order processing",
            "System failures and data loss",
            "Fraud and unauthorized access",
            "Regulatory enforcement actions",
            "Changes in business operations",
          ],
        },
      ],
    },
    {
      heading: "8. Regulatory Risk",
      blocks: [
        { kind: "text", text: "Financial regulations are subject to change. Changes in regulations could:" },
        {
          kind: "list",
          items: [
            "Restrict trading in certain instruments",
            "Reduce maximum leverage available",
            "Increase trading costs through new fees",
            "Require account closure for certain jurisdictions",
            "Affect platform availability in your country",
          ],
        },
      ],
    },
    {
      heading: "9. Negative Balance Protection",
      blocks: [
        {
          kind: "text",
          text: "While FX Artha offers negative balance protection, meaning your account cannot go below zero, this protection may not apply in all circumstances, including:",
        },
        {
          kind: "list",
          items: [
            "Extreme market gaps and flash crashes",
            "System failures during market volatility",
            "Violations of our terms of service",
          ],
        },
      ],
    },
    {
      heading: "10. Risk Management Best Practices",
      blocks: [
        { kind: "text", text: "To manage trading risks:" },
        {
          kind: "list",
          items: [
            "Only trade with capital you can afford to lose",
            "Use stop-loss orders to limit potential losses",
            "Diversify your portfolio across multiple instruments",
            "Avoid over-leveraging your account",
            "Keep up with economic news and market developments",
            "Develop and follow a trading plan",
            "Avoid emotional decision-making",
            "Start with a demo account to practice",
            "Educate yourself about markets and trading",
          ],
        },
      ],
    },
    {
      heading: "11. Acknowledgment",
      blocks: [
        {
          kind: "text",
          text: "By opening an account with FX Artha, you acknowledge that you have read and understood this Risk Disclosure, and you accept all risks associated with trading on our platform. You confirm that you are trading at your own risk and that FX Artha is not responsible for any losses incurred.",
        },
      ],
    },
    {
      heading: "12. Contact Information",
      blocks: [
        { kind: "text", text: "For questions about risk management or this disclosure, please contact:" },
        contact("Risk Management Team", "risk@fxartha.com"),
      ],
    },
  ],
};
