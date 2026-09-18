import { clsx, type ClassValue } from 'clsx';

/**
 * Class-name combiner. Uses clsx only (no tailwind-merge dependency);
 * conflicting Tailwind classes resolve by source order, which is fine
 * for the marketing components that call this.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
