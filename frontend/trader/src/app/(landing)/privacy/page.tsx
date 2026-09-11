export const metadata = { title: 'Privacy Policy — SetupFX' }

/**
 * Privacy Policy, rewritten for a software development company.
 *
 * The previous version described collecting KYC documents, deposits,
 * withdrawals and trade records from retail traders — the data a brokerage
 * holds about its clients. We hold none of that. What we actually collect is
 * business enquiry details, and during a project, whatever a client shares
 * with us to get their platform built.
 *
 * The distinction that matters legally is in section 6: on a platform we
 * built and a client operates, the client is the data controller for their
 * users, not us.
 */
export default function PrivacyPage() {
  return (
    <div className="bg-white text-gray-900">
      <section className="bg-white pt-16 pb-12">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500">Last updated: September 2026</p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="w-full px-3 sm:px-6 lg:px-8 space-y-10">
          <Section title="1. Who this covers">
            This policy explains how Setupfx Softech OPC Pvt Ltd (&ldquo;SetupFX&rdquo;, &ldquo;we&rdquo;)
            handles personal information collected through this website and in the course of
            discussing or delivering a software project. We are a software development company;
            we do not operate a trading service and we do not hold trading accounts, client
            funds or trading records belonging to members of the public.
          </Section>

          <Section title="2. What we collect">
            <p className="font-semibold text-gray-900 mt-4 mb-1">When you contact us</p>
            Your name, email address, phone or WhatsApp number, company name and whatever you
            choose to tell us about the project you are planning.
            <p className="font-semibold text-gray-900 mt-4 mb-1">Automatically, when you browse</p>
            Standard server and analytics data: IP address, browser and device type, pages
            visited and referring page. Used to keep the site working and to understand which
            pages are useful.
            <p className="font-semibold text-gray-900 mt-4 mb-1">During a project, if you become a client</p>
            Business contact details for the people we work with, and technical and commercial
            information needed to scope, build and support the platform. We ask clients not to
            send us their own customers&rsquo; personal data unless a specific task genuinely
            requires it.
          </Section>

          <Section title="3. Why we use it">
            <List items={[
              'To reply to your enquiry and arrange a demonstration.',
              'To prepare a scope, timeline and quotation.',
              'To deliver, support and maintain software under a signed agreement.',
              'To send information about our services where you have asked for it — never bought lists, and every message carries an unsubscribe.',
              'To meet our legal, tax and accounting obligations in India.',
            ]} />
            We do not sell personal information, and we do not share it for anyone else&rsquo;s
            marketing.
          </Section>

          <Section title="4. Who we share it with">
            Only with service providers who help us run the business — email and hosting
            providers, analytics, accounting — each bound to handle it on our instructions, and
            with authorities where the law requires it.
          </Section>

          <Section title="5. How long we keep it">
            Enquiries that do not become projects are kept while there is a live commercial
            conversation and a reasonable period after, then deleted. Client project records are
            kept for the life of the engagement and for as long as Indian tax and company law
            requires afterwards.
          </Section>

          <Section title="6. Platforms we build for clients">
            This is the part most often misunderstood, so it is stated directly. When a client
            operates a trading platform we developed, any personal data their users provide —
            identity documents, payment details, trading activity — is collected by that client,
            for that client, under that client&rsquo;s own privacy policy. They are the data
            controller. We act only as a processor, on their written instructions, where a
            support or maintenance task requires it. If you are a user of a platform operated by
            one of our clients, your rights lie with them, and their privacy policy is the one
            that applies to you.
          </Section>

          <Section title="7. Your rights">
            You may ask us for a copy of the personal information we hold about you, ask us to
            correct it, or ask us to delete it where we have no continuing legal reason to keep
            it. You may also withdraw consent to marketing at any time. Write to
            setupfx24@gmail.com and we will respond within a reasonable period.
          </Section>

          <Section title="8. Cookies">
            We use cookies that are necessary for the site to function, and analytics cookies to
            see which pages are read. Your browser can block or delete cookies; the site will
            still work, though some preferences will not persist.
          </Section>

          <Section title="9. Security">
            Access to enquiry and project data is restricted to the people who need it, and
            transport to this site is encrypted. No system is perfectly secure, and we do not
            claim otherwise — but the narrower point is that we deliberately do not collect the
            categories of data that would make us an attractive target: no client funds, no
            payment credentials, no public trading accounts.
          </Section>

          <Section title="10. Changes">
            We will update this policy as our practices change, and the revision date above will
            change with it.
          </Section>

          {/* The footer has always linked to /privacy#vulnerability and the
              anchor never existed, so "Vulnerability Disclosure" led to the
              top of this page. */}
          <div id="vulnerability" className="scroll-mt-24">
            <Section title="11. Reporting a security vulnerability">
              If you believe you have found a security flaw in this website or in software we
              develop, tell us before telling anyone else. Email setupfx24@gmail.com with enough
              detail to reproduce it — the affected URL or component, the steps, and what you
              were able to access.
              <br /><br />
              We will acknowledge your report, keep you updated while we investigate, and we will
              not pursue action against anyone who reports in good faith, stays within the scope
              of demonstrating the issue, and does not access, modify or retain data belonging to
              anyone else. Please give us reasonable time to fix an issue before publishing it.
            </Section>
          </div>

          <Section title="12. Contact">
            Setupfx Softech OPC Pvt Ltd, 4012, 4th Floor, Currency Tower, Vishal Nagar, Raipur,
            Chhattisgarh 492001. Email setupfx24@gmail.com.
          </Section>
        </div>
      </section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
      <div className="text-gray-500 leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-2 mt-3 text-gray-500">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}
