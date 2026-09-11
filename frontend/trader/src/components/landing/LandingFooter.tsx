import Link from 'next/link'
import Image from 'next/image'
import { Mail, Phone } from 'lucide-react'

export default function LandingFooter() {
  return (
    <footer className="bg-tx-bg border-t border-tx-line py-12">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
          <div className="lg:col-span-2">
            <Link href="/" aria-label="SwissCresta home" className="inline-flex items-center gap-2 mb-4">
              <Image
                src="/marketing/swisscresta-logo.png"
                alt="SwissCresta"
                width={1947}
                height={361}
                className="h-9 w-auto"
              />
            </Link>
            <p className="text-tx-muted text-sm leading-relaxed mb-3 max-w-sm">
              A software development company building white-label trading platforms
              for forex brokerages, Indian market brokers and prop firms.
            </p>
            <p className="text-tx-muted text-sm">
              <span className="font-medium text-tx-strong">Setupfx Softech OPC Pvt Ltd</span><br />
              4012, 4th Floor, Currency Tower, Vishal Nagar,<br />Raipur, Chhattisgarh 492001
            </p>
          </div>

          <div>
            <p className="font-semibold text-tx-strong mb-4">Platforms</p>
            <ul className="space-y-2 text-sm text-tx-muted">
              <li><Link href="/platforms" className="hover:text-tx-strong transition-colors">All Platforms</Link></li>
              <li><Link href="/white-label" className="hover:text-tx-strong transition-colors">Development Services</Link></li>
              <li><Link href="/how-it-works" className="hover:text-tx-strong transition-colors">How It Works</Link></li>
              <li><Link href="/partners" className="hover:text-tx-strong transition-colors">Partner With Us</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-tx-strong mb-4">Company</p>
            <ul className="space-y-2 text-sm text-tx-muted">
              <li><Link href="/about" className="hover:text-tx-strong transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-tx-strong transition-colors">Contact</Link></li>
              <li><Link href="/policy" className="hover:text-tx-strong transition-colors">Policy & Legal</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-tx-strong mb-4">Support</p>
            <ul className="space-y-2 text-sm text-tx-muted">
              <li><Link href="/contact" className="hover:text-tx-strong transition-colors">Contact Us</Link></li>
              <li>
                <a
                  href="mailto:setupfx24@gmail.com"
                  className="inline-flex items-center gap-2 hover:text-tx-strong transition-colors"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>setupfx24@gmail.com</span>
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/19082280305"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-tx-strong transition-colors"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>+1 (908) 228-0305</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-tx-line pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-tx-muted text-sm">&copy; {new Date().getFullYear()} SetupFX. All rights reserved.</p>
          <div className="flex items-center gap-5 text-sm text-tx-muted">
            <Link href="/privacy" className="hover:text-tx-strong transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-tx-strong transition-colors">Terms of Service</Link>
            <Link href="/risk" className="hover:text-tx-strong transition-colors">Disclaimer</Link>
            <Link href="/account-deletion" className="hover:text-tx-strong transition-colors">Account Deletion</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
