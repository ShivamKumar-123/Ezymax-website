'use client';

import { useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * Small "TV" card for the dashboard right rail: plays the FXArtha commercial
 * (the landing hero's former loop) muted on repeat inside a bezel, with a
 * pulsing channel badge and a sound toggle.
 */
export default function TvCard() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  return (
    <div
      className="hover-lift w-full overflow-hidden rounded-2xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      {/* screen with bezel */}
      <div className="relative m-2.5 overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          src="/videos/fxartha-commercial.mp4"
          autoPlay
          muted={muted}
          loop
          playsInline
          preload="metadata"
          aria-label="FXArtha commercial"
          className="block aspect-video w-full object-cover"
        />

        {/* channel badge */}
        <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-white uppercase backdrop-blur-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d6a93d] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#d6a93d]" />
          </span>
          FXArtha TV
        </span>

        <button
          type="button"
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={() => setMuted((m) => !m)}
          className="absolute right-2 bottom-2 rounded-full bg-black/55 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
        >
          {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>
      </div>

      <p className="px-3.5 pb-3 text-[11px] text-text-tertiary">
        Trade the markets at full speed — the FXArtha film.
      </p>
    </div>
  );
}
