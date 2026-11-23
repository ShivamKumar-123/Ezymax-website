import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Round rotating-text call to action (the references' circular "Sign up"). */
export function CircleCta({
  href,
  text = 'Open an account · Open an account · ',
  label = 'Open an account',
  className,
  size = 148,
  uid = 'a',
}: {
  href: string;
  text?: string;
  label?: string;
  className?: string;
  size?: number;
  uid?: string;
}) {
  const pathId = `cta-circle-${uid}`;
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn('group relative grid flex-none place-items-center rounded-full', className)}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-full border border-white/15 bg-black/30 backdrop-blur-md transition-colors duration-500 group-hover:border-ember/60" />
      <svg viewBox="0 0 100 100" className="absolute inset-[6%] animate-spin-slow" aria-hidden>
        <defs>
          <path id={pathId} d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
        </defs>
        <text fill="#f5f5f7" fontSize="8.4" letterSpacing="2.1" style={{ textTransform: 'uppercase', fontWeight: 600 }}>
          <textPath href={`#${pathId}`}>{text}</textPath>
        </text>
      </svg>
      <span className="relative grid h-[42%] w-[42%] place-items-center rounded-full bg-[linear-gradient(120deg,#ff5a1f,#ff8a3d)] text-[#120804] shadow-[0_0_40px_rgba(255,90,31,0.6)] transition-transform duration-500 group-hover:scale-110">
        <ArrowUpRight size={size * 0.17} strokeWidth={2} aria-hidden className="transition-transform duration-500 group-hover:rotate-45" />
      </span>
    </Link>
  );
}
