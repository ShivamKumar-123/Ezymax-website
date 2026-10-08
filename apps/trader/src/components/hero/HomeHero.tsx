import type { CSSProperties, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Headline } from '@/components/motion/Headline';
import { REGISTER_HREF } from '@/lib/crm';
import { HERO } from '@/content/site';
import robot from '@/content/heroRobot.json';
import HeroMotion from '@/components/hero/HeroMotion';

/**
 * Homepage hero: the founder's robot artwork (the stage) with the page statement (the h1), subline and the one call
 * to action on the left (stacked below the picture on portrait phones).
 *
 * SHARPNESS FIRST: the artwork is never shown larger than its native pixels at the screen's density (1672 px source
 * -> at most 836 CSS px on a 2x screen, 557 on 3x). Around that crisp core, a blurred edge-extended copy of the same
 * picture (hero-robot-backdrop) continues the scene to the edges, and the core's edges are feathered into it. With a
 * 3840 px+ export (public/images/brand/src-hero-robot@4k.*, then `node scripts/hero-robot-assets.mjs`), the cap rises
 * and the hero becomes truly full-bleed on retina screens automatically. Layout: .hero-robot* in globals.css.
 *
 * SWAPPING THE HERO: pass another `stage`.
 */
export function HomeHero({ stage = <RobotStage /> }: { stage?: ReactNode }) {
  return (
    <section className="hero-robot relative isolate overflow-hidden bg-[#0a0203]" aria-labelledby="hero-title">
      <div className="absolute inset-0 -z-10">{stage}</div>

      {/* Readability: nav scrim, a scrim behind the text only (left on landscape, bottom on portrait), and the bottom
          edge fading into the page (#07070a). None of them reaches the helmet. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/45 to-transparent" />
      <div aria-hidden className="hero-text-scrim pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-ink" />

      <div className="hero-copy container-site relative flex h-full flex-col">
        <div className="hero-copy-inner flex flex-col items-start">
          <p className="kicker kicker-crimson fade-up-now mb-6 lg:mb-7" style={{ ['--d' as string]: '0.5s' }}>
            {HERO.eyebrow}
          </p>
          <Headline
            as="h1"
            id="hero-title"
            now
            delay={0.55}
            lines={[HERO.headline[0], <span key="b" className="text-crimson-grad">{HERO.headline[1]}</span>]}
            className="t-hero-robot"
          />
          <p className="t-lead fade-up-now mt-6 max-w-[30rem] text-fg lg:mt-7" style={{ ['--d' as string]: '0.9s' }}>
            {HERO.subline}
          </p>
          <div className="fade-up-now mt-8 lg:mt-9" style={{ ['--d' as string]: '1.1s' }}>
            <Button
              href={REGISTER_HREF}
              className="!h-14 !px-7 !text-[1.05rem] shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_18px_50px_-12px_rgba(0,0,0,0.8),0_0_50px_-10px_rgba(255,90,31,0.7)]"
            >
              {HERO.cta}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const SIZES = [
  `(min-resolution: 2.5dppx) min(100vw, ${Math.round(robot.native / 3)}px)`,
  `(min-resolution: 1.75dppx) min(100vw, ${Math.round(robot.native / 2)}px)`,
  `(min-resolution: 1.25dppx) min(100vw, ${Math.round(robot.native / 1.5)}px)`,
  `min(100vw, ${robot.native}px)`,
].join(', ');

/** The founder's robot artwork: crisp core + seamless backdrop. */
function RobotStage() {
  const set = (ext: string) =>
    robot.widths.map((w) => `${robot.name}${w === robot.native ? '' : `-${w}`}.${ext} ${w}w`).join(', ');
  const vars = { '--native': robot.native, '--ratio': robot.height / robot.native } as CSSProperties;
  return (
    <div className="hero-robot-stage absolute inset-0" style={vars}>
      {/* LCP image: preloaded (AVIF where supported) */}
      <link rel="preload" as="image" type="image/avif" imageSrcSet={set('avif')} imageSizes={SIZES} fetchPriority="high" />
      <div className="hero-robot-core">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={robot.backdrop} alt="" aria-hidden className="hero-robot-backdrop" decoding="async" />
        <picture className="hero-robot-art">
          <source type="image/avif" srcSet={set('avif')} sizes={SIZES} />
          <source type="image/webp" srcSet={set('webp')} sizes={SIZES} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${robot.name}.webp`}
            srcSet={set('webp')}
            sizes={SIZES}
            width={robot.native}
            height={robot.height}
            alt="Ezymex: a black robot helmet in profile with a glowing red eye and visor, in front of a huge glowing red circle and flowing red and black waves"
            fetchPriority="high"
            decoding="async"
          />
        </picture>

        {/* Light effects, positioned in % of the picture so they track at every size (globals.css: .hr-*) */}
        <div aria-hidden className="hr-fx">
          <span className="hr-eye-bloom" style={{ left: `${robot.eye.x}%`, top: `${robot.eye.y}%` }} />
          <span className="hr-eye-core" style={{ left: `${robot.eye.x}%`, top: `${robot.eye.y}%` }} />
          <div className="hr-masked hr-visor" style={{ ['--mask' as string]: `url(${robot.masks.visor})` }}>
            <span className="hr-band" />
          </div>
          <div className="hr-masked hr-rim" style={{ ['--mask' as string]: `url(${robot.masks.rim})` }}>
            <span
              className="hr-wedge"
              style={{ left: `${robot.circle.x}%`, top: `${robot.circle.y}%`, width: `${robot.circle.r * 2.3}%` }}
            />
          </div>
        </div>
      </div>
      <HeroMotion />
    </div>
  );
}
