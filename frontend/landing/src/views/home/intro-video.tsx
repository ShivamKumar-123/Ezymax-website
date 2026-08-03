"use client";

import { animated, useSpring } from "@react-spring/web";
import { useEffect, useRef, useState } from "react";

import { Close } from "@/components/ui/icons";
import { useScroll } from "@/hooks/smooth-scroll/use-scroll";
import { useUi } from "@/lib/ui-store";
import type { introContent } from "@/data/mocks/home";

export interface IntroVideoProps {
  content: typeof introContent;
}

/**
 * Full-screen opening film. Holds the site until it finishes, then slides away
 * and releases the `ready` gate that every above-the-fold reveal waits on.
 *
 * Autoplay only survives browser policy when muted, so the film starts silent
 * and offers a sound toggle rather than assuming permission. If the play()
 * promise is rejected anyway (stricter policies, data-saver), the intro exits
 * immediately instead of trapping the visitor behind a frozen frame.
 */
export const IntroVideo = ({ content }: IntroVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);
  const [muted, setMuted] = useState(true);
  // A visitor arriving from a sub-page has already been released past the
  // `ready` gate — replaying the film mid-session would trap them behind it.
  const [skipped] = useState(() => useUi.getState().ready);
  const setReady = useUi((state) => state.setReady);
  const startScroll = useScroll((state) => state.start);
  const stopScroll = useScroll((state) => state.stop);

  useEffect(() => {
    if (skipped) return;
    stopScroll();
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => setDone(true));
  }, [skipped, stopScroll]);

  // A visitor who never sees the film still has to reach the site.
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => {
      setReady();
      startScroll();
      setGone(true);
    }, 700);
    return () => clearTimeout(id);
  }, [done, setReady, startScroll]);

  const panel = useSpring({
    y: done ? "-100%" : "0%",
    config: { tension: 220, friction: 30 },
  });

  if (skipped || gone) return null;

  return (
    <animated.div
      style={{ transform: panel.y.to((y) => `translateY(${y})`) }}
      className="fixed inset-0 z-[120] overflow-hidden rounded-b-card bg-black"
    >
      <video
        ref={videoRef}
        src={content.src}
        muted={muted}
        playsInline
        preload="auto"
        aria-label={content.label}
        onEnded={() => setDone(true)}
        // `contain`, not `cover`: the film is portrait and carries its own
        // titles, which `cover` crops off on a wide viewport. The letterbox is
        // invisible against the black panel.
        className="absolute inset-0 h-full w-full object-contain"
      />

      <div className="relative flex h-full flex-col justify-end p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-pressed={!muted}
            className="rounded-pill border border-white/25 px-5 py-2 text-xs font-medium font-mono tracking-label text-white/80 uppercase transition-colors duration-[var(--duration-fast)] ease-entrance hover:border-accent hover:text-accent"
          >
            {muted ? content.soundOn : content.soundOff}
          </button>

          <button
            type="button"
            onClick={() => setDone(true)}
            className="inline-flex items-center gap-2 rounded-pill bg-accent px-5 py-2 text-xs font-medium font-mono tracking-label text-ink uppercase transition-colors duration-[var(--duration-fast)] ease-entrance hover:bg-accent-from"
          >
            {content.skip}
            <Close className="text-xs" />
          </button>
        </div>
      </div>
    </animated.div>
  );
};
