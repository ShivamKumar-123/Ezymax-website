import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="relative flex min-h-[80svh] items-center overflow-hidden pt-32">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 ember-glow" aria-hidden />
      <div className="container-x relative text-center">
        <span className="bracket">Page not found</span>
        <p className="mt-6 font-pixel text-8xl text-ink md:text-9xl">404</p>
        <p className="mx-auto mt-6 max-w-md text-lg text-muted">This page does not exist or has moved. Let&apos;s get you back to the technology.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button href="/" icon>
            Back home
          </Button>
          <Button href="/solutions" variant="outline">
            Explore Solutions
          </Button>
        </div>
      </div>
    </section>
  );
}
