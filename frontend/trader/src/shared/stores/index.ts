/**
 * Global stores — shared across all features.
 * Feature-specific stores live in features/X/store/.
 *
 * Import as: import { useUIStore } from '@/shared/stores';
 */

export { useUIStore } from '@/stores/uiStore';
export { useShellStore } from '@/stores/shellStore';
export { usePlatformStatusStore } from '@/stores/platformStatusStore';
export { useWSStore } from '@/stores/wsStore';
