export const metadata = {
  title: 'Account & Data Deletion — SwissCresta',
  description:
    'How to request deletion of your SwissCresta account and associated data, what is removed, and what we are legally required to retain.',
}

export default function AccountDeletionPage() {
  return (
    <div className="bg-white text-gray-900">
      <section className="bg-white pt-16 pb-12">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Account &amp; Data Deletion</h1>
          <p className="text-gray-500">Last updated: June 2026</p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="w-full px-3 sm:px-6 lg:px-8 space-y-10">

          {/* This page exists because Google Play requires an account-deletion
              route for any app that lets users create an account, and it
              describes the SwissCresta trading application — not SetupFX. Left
              accurate rather than rewritten into the vendor's voice, because a
              user looking for how to delete their account needs the real
              procedure. The banner scopes it so the rest of the site is not
              read as SetupFX holding anyone's balance. */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 mb-2">
            <p className="text-sm leading-relaxed text-gray-600">
              <span className="font-semibold text-gray-900">This page is for users of the SwissCresta trading application.</span>{' '}
              SetupFX is a software development company and does not operate that application,
              hold its users&rsquo; funds or maintain their accounts. The procedure below is
              handled by the operator of the app.
            </p>
          </div>

          <Section title="Overview">
            This page explains how you, as a SwissCresta user, can request deletion of your
            account and the personal data associated with it. It also describes which data is
            permanently deleted, which data we are legally required to retain, and how long the
            process takes. This applies to accounts created through the SwissCresta mobile app
            (Android) and the SwissCresta web platform.
          </Section>

          <Section title="How to request deletion">
            You can request deletion of your account using any of the methods below. For security,
            requests must come from — or be verifiable against — the email address registered to
            your SwissCresta account.

            <Sub title="Option 1 — From within the app">
              <List items={[
                'Open the SwissCresta app and sign in.',
                'Go to Profile → Support.',
                'Create a request with the subject "Delete my account".',
              ]} />
            </Sub>

            <Sub title="Option 2 — By email">
              Send an email from your registered email address to{' '}
              <a href="mailto:support@swisscresta.com?subject=Account%20Deletion%20Request"
                 className="text-[#E94E1B] hover:underline">support@swisscresta.com</a>{' '}
              with the subject line <span className="font-semibold text-gray-700">&quot;Account Deletion Request&quot;</span>.
              Please include the email address (and, if known, the account number) tied to your
              SwissCresta account so we can locate and verify it.
            </Sub>

            <p className="mt-4 text-gray-500">
              We may ask you to confirm your identity before processing the request — this protects
              your account from unauthorized deletion.
            </p>
          </Section>

          <Section title="What data is deleted">
            Once your request is verified and any regulatory retention period has elapsed, the
            following data is permanently deleted from our active systems:
            <List items={[
              'Your profile information — name, email, phone number, and address',
              'Account preferences and settings (theme, watchlists, notification settings)',
              'Marketing and communication preferences',
              'Support tickets and in-app messages',
              'Device and session information linked to your account',
              'Any saved payout/wallet details not subject to legal retention',
            ]} />
          </Section>

          <Section title="What data we must retain (and why)">
            SwissCresta operates a regulated financial / trading service. Certain records cannot be
            deleted immediately on request because we are legally obligated to keep them under
            financial, anti-money-laundering (AML), and tax regulations:
            <List items={[
              'Identity verification (KYC) documents and verification results',
              'Transaction history — deposits, withdrawals, and trades',
              'Records required for AML, fraud-prevention, and audit purposes',
              'Information needed to resolve disputes or enforce our agreements',
            ]} />
            <p className="mt-4 text-gray-500">
              These records are retained for the minimum period required by applicable law —
              typically <span className="font-semibold text-gray-700">7 years</span> — after which
              they are permanently deleted. During this period the data is access-restricted and
              used only for legal and compliance purposes, not for marketing or active service.
            </p>
          </Section>

          <Section title="Before you delete — settle your balance">
            If your account holds a positive balance or open positions, please withdraw your funds
            and close any open trades before requesting deletion. We cannot return funds after an
            account is closed, and open positions must be settled first.
          </Section>

          <Section title="Processing time">
            <List items={[
              'Deletion requests are acknowledged within 72 hours.',
              'Eligible personal data is removed from active systems within 30 days.',
              'Data under legal retention is deleted at the end of the required retention period (see above).',
            ]} />
          </Section>

          <Section title="Contact">
            For any questions about account or data deletion, or to check the status of a request,
            contact us:
            <ContactBox team="Data Protection Team" email="support@swisscresta.com" />
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

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
      {children}
    </div>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1.5 mt-2 text-gray-500">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}

function ContactBox({ team, email }: { team: string; email: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-4 text-sm space-y-1">
      <p className="font-semibold text-gray-900">SwissCresta {team}</p>
      <p className="text-gray-500">Email: {email}</p>
      <p className="text-gray-500">
        Phone:{' '}
        <a href="tel:+33759159987" className="text-gray-900 hover:text-[#E94E1B] transition-colors">
          +33 7 59 15 99 87
        </a>
      </p>
      <p className="text-gray-500">Address: Rue de la Tour-de-l&apos;Île 4, 1204 Genève</p>
    </div>
  )
}
