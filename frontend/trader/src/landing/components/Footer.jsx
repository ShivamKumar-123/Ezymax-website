import { Link } from 'react-router-dom'
import { Twitter, Linkedin, Instagram, Youtube } from 'lucide-react'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from './animations/ScrollReveal'

const Footer = () => {
  const footerLinks = {
    trading: [
      { name: 'Forex', path: '/trading/forex' },
      { name: 'Commodities', path: '/trading/commodities' },
      { name: 'Indices', path: '/trading/indices' },
      { name: 'Crypto', path: '/trading/crypto' },
    ],
    platforms: [
      { name: 'Web Platform', path: '/platforms/web' },
      { name: 'Copy Trading', path: '/platforms/copy-trading' },
      { name: 'Prop Trading', path: '/platforms/prop-trading' },
      { name: 'IB Management', path: '/platforms/ib-management' },
    ],
    accounts: [
      { name: 'Standard', path: '/accounts/standard' },
      { name: 'Pro', path: '/accounts/pro' },
      { name: 'Demo', path: '/accounts/demo' },
    ],
    company: [
      { name: 'About Us', path: '/company/about' },
      { name: 'Why TrustEdgeFX', path: '/company/why-trustedge' },
      { name: 'Contact', path: '/company/contact' },
    ],
    education: [
      { name: 'Tutorials', path: '/education/tutorials' },
      { name: 'Blog', path: '/education/blog' },
      { name: 'Market News', path: '/education/news' },
    ],
  }

  const socialLinks = [
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
    { icon: Instagram, href: '#', label: 'Instagram' },
    { icon: Youtube, href: '#', label: 'YouTube' },
  ]

  return (
    <footer className="bg-[#070B15] border-t border-white/5">
      <div className="container-custom py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10 mb-12">
          {/* Logo & Social */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <ScrollReveal variant="fadeLeft">
              <Link to="/" className="inline-block mb-4">
                <img src="/images/logo2.png" alt="TrustEdgeFX" className="h-10 w-auto" />
              </Link>
              <p className="text-text-secondary text-sm mb-6">
                Trade with confidence. Trade with TrustEdgeFX.
              </p>
              <ScrollRevealGroup className="flex space-x-3" delay={0.4}>
                {socialLinks.map((social) => (
                  <ScrollRevealItem key={social.label}>
                    <a
                      href={social.href}
                      className="w-9 h-9 rounded-md bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all duration-200"
                      aria-label={social.label}
                    >
                      <social.icon className="w-4 h-4 text-text-secondary" />
                    </a>
                  </ScrollRevealItem>
                ))}
              </ScrollRevealGroup>
            </ScrollReveal>
          </div>

          {/* Trading */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div>
              <h3 className="text-white font-semibold text-sm mb-4">Trading</h3>
              <ul className="space-y-2">
                {footerLinks.trading.map((link) => (
                  <li key={link.path}>
                    <Link to={link.path} className="text-text-secondary text-sm hover:text-white transition-colors duration-200">{link.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Platforms */}
          <ScrollReveal variant="fadeUp" delay={0.15}>
            <div>
              <h3 className="text-white font-semibold text-sm mb-4">Platforms</h3>
              <ul className="space-y-2">
                {footerLinks.platforms.map((link) => (
                  <li key={link.path}>
                    <Link to={link.path} className="text-text-secondary text-sm hover:text-white transition-colors duration-200">{link.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Accounts */}
          <ScrollReveal variant="fadeUp" delay={0.2}>
            <div>
              <h3 className="text-white font-semibold text-sm mb-4">Accounts</h3>
              <ul className="space-y-2">
                {footerLinks.accounts.map((link) => (
                  <li key={link.path}>
                    <Link to={link.path} className="text-text-secondary text-sm hover:text-white transition-colors duration-200">{link.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Company */}
          <ScrollReveal variant="fadeUp" delay={0.25}>
            <div>
              <h3 className="text-white font-semibold text-sm mb-4">Company</h3>
              <ul className="space-y-2">
                {footerLinks.company.map((link) => (
                  <li key={link.path}>
                    <Link to={link.path} className="text-text-secondary text-sm hover:text-white transition-colors duration-200">{link.name}</Link>
                  </li>
                ))}
              </ul>
              <h3 className="text-white font-semibold text-sm mt-6 mb-4">Education</h3>
              <ul className="space-y-2">
                {footerLinks.education.map((link) => (
                  <li key={link.path}>
                    <Link to={link.path} className="text-text-secondary text-sm hover:text-white transition-colors duration-200">{link.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeIn" delay={0.5}>
          <div className="pt-8 border-t border-white/5">
            <p className="text-text-secondary text-xs text-center">
              © 2025 TrustEdgeFX Ltd. All rights reserved. | Risk Warning: Trading involves significant risk of loss.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </footer>
  )
}

export default Footer
