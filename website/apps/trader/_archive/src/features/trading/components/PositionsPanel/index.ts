/**
 * PositionsPanel — split into focused sub-components.
 *
 * Usage (from old import path — no breaking changes):
 *   import PositionsPanel from '@/components/trading/PositionsPanel';
 *
 * Usage (new canonical path):
 *   import { PositionsPanel } from '@/features/trading/components/PositionsPanel';
 */

export { TerminalPositionCard } from './TerminalPositionCard';
export { ClosePositionModal } from './ClosePositionModal';
export { BulkCloseModal } from './BulkCloseModal';
export * from './positionsPanel.utils';
