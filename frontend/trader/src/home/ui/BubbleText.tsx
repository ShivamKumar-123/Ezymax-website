'use client';

import { useState } from 'react';
import { type ElementType } from 'react';

type Props = {
  text: string;
  className?: string;
  as?: ElementType;
};

export function BubbleText({ text, className = '', as: Tag = 'h2' }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const Component = Tag as ElementType;

  return (
    <Component
      onMouseLeave={() => setHoveredIndex(null)}
      // Google Translate would otherwise butcher the per-char spans into
      // garbage like "TRADAND SMARTANDR" — opt out for this element.
      translate="no"
      className={`notranslate ${className}`}
      style={{ color: '#ffffff' }}
    >
      {text.split('').map((char, idx) => {
        const distance = hoveredIndex !== null ? Math.abs(hoveredIndex - idx) : null;

        let opacity = 1;
        let glow = '0 0 0 rgba(255,255,255,0)';

        if (distance === null) {
          opacity = 1;
          glow = '0 0 0 rgba(255,255,255,0)';
        } else if (distance === 0) {
          opacity = 1;
          glow = '0 0 18px rgba(255,255,255,0.95), 0 0 38px rgba(255,255,255,0.55)';
        } else if (distance === 1) {
          opacity = 1;
          glow = '0 0 10px rgba(255,255,255,0.7), 0 0 22px rgba(255,255,255,0.35)';
        } else if (distance === 2) {
          opacity = 0.95;
          glow = '0 0 6px rgba(255,255,255,0.45)';
        } else if (distance === 3) {
          opacity = 0.85;
          glow = '0 0 0 rgba(255,255,255,0)';
        } else {
          opacity = 0.6;
          glow = '0 0 0 rgba(255,255,255,0)';
        }

        return (
          <span
            key={idx}
            onMouseEnter={() => setHoveredIndex(idx)}
            className="inline-block cursor-default"
            style={{
              color: '#ffffff',
              opacity,
              textShadow: glow,
              transition:
                'opacity 380ms cubic-bezier(0.22, 1, 0.36, 1), text-shadow 380ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {char === ' ' ? ' ' : char}
          </span>
        );
      })}
    </Component>
  );
}
