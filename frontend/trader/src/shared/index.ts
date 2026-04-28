/**
 * Shared module — cross-feature code.
 * Prefer granular barrel imports over this root barrel.
 *
 * @example
 * import { Button, Card } from '@/shared/components/ui';
 * import { useDebounce } from '@/shared/hooks';
 * import { cn } from '@/shared/lib';
 * import { useUIStore } from '@/shared/stores';
 */

export { ErrorBoundary } from './components/ErrorBoundary';
