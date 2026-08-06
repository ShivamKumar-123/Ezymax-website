'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * Full-width commercial banner at the top of the dashboard: the FXArtha film
 * (the landing hero's former loop) slides in from the RIGHT to its resting
 * place, playing muted on repeat, with a pulsing channel badge and a sound
 * toggle.
 */
export default function TvCard() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  return (
    <motion.div
      initial={{ x: '60%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 70, damping: 18 }}
      className="relative w-full overflow-hidden rounded-2xl"
      style={{ border: '1px solid var(--border-primary)' }}
    >
      <video
        ref={videoRef}
        src="/videos/fxartha-commercial.mp4"
        autoPlay
        muted={muted}
        loop
        playsInline
        preload="metadata"
        aria-label="FXArtha commercial"
        className="block h-36 w-full object-cover sm:h-48 lg:h-56"
      />

      {/* left scrim so the badge/copy read over the film */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,.55),transparent_45%)]"
      />

      <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-white uppercase backdrop-blur-sm">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ccff00] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ccff00]" />
        </span>
        FXArtha TV
      </span>

      <p className="absolute bottom-3 left-3 max-w-[60%] text-xs font-medium text-white/90 sm:text-sm">
        Trade the markets at full speed — the FXArtha film.
      </p>

      <button
        type="button"
        aria-label={muted ? 'Unmute' : 'Mute'}
        onClick={() => setMuted((m) => !m)}
        className="absolute right-3 bottom-3 rounded-full bg-black/55 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </motion.div>
  );
}
