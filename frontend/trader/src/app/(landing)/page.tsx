import HomePage from '@/home/HomePage'

/**
 * Public homepage at the root of the marketing domain.
 *
 * Renders the cinematic marketing site (ported from the standalone
 * Vite project, now living in src/home) which brings its own Navbar,
 * footer, fonts and dark-only theme. The (landing) layout detects the
 * `/` path and suppresses its legacy chrome so the two don't stack.
 */
export default function LandingHomePage() {
  return <HomePage />
}
