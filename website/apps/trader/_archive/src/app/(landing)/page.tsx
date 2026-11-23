import HomePage from '@/home-nexola/HomePage';

/**
 * Public homepage at the root of the marketing domain.
 *
 * Renders the Nexola-reference homepage (src/home-nexola), which brings
 * its own fixed header, menu drawer, sections and footer. The (landing)
 * layout detects the `/` path and suppresses its legacy chrome so the two
 * don't stack.
 *
 * Earlier homepages are kept on disk for reference:
 *   - src/homepage  (Azzle-style layout)
 *   - src/home      (original cinematic home; its Navbar still serves inner pages)
 */
export default function LandingHomePage() {
  return <HomePage />;
}
