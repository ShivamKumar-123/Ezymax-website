import { cn } from "@/lib/cn";

/** Pure-CSS stand-in for the 3D hero: a glossy dark ring lit by orange and red glows. */
export function HeroFallback({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex size-full items-center justify-center", className)} aria-hidden>
      <div className="absolute h-[60%] w-[70%] ember-glow" />
      <div
        className="relative aspect-square w-[62%] max-w-[560px] rounded-full animate-float"
        style={{
          background: "radial-gradient(circle at 32% 28%, #2a221d 0%, #0b0908 45%, #050505 70%)",
          boxShadow:
            "inset 0 0 80px rgb(255 106 0 / 0.28), inset 18px -18px 60px rgb(179 18 27 / 0.25), 0 0 120px rgb(255 106 0 / 0.22), 0 40px 120px rgb(0 0 0 / 0.6)",
        }}
      >
        <div
          className="absolute inset-[26%] rounded-full"
          style={{
            background: "radial-gradient(circle at 60% 70%, #0e0a08, #060606 70%)",
            boxShadow: "inset 0 0 50px rgb(0 0 0 / 0.9), 0 0 40px rgb(255 106 0 / 0.25)",
          }}
        />
        <div className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 200deg, transparent 0deg, rgb(255 138 61 / 0.55) 40deg, transparent 110deg, transparent 250deg, rgb(179 18 27 / 0.45) 300deg, transparent 360deg)", mixBlendMode: "screen", filter: "blur(6px)" }} />
      </div>
    </div>
  );
}
