// Ladder geometry. Kept apart from Ladder.tsx on purpose: importing that module loads
// Skia, which on the web must only happen after CanvasKit is ready (LadderLazy.web.tsx).
import { LEVELS } from "./book";

export const ROW_H = 44;
export const ROWS = LEVELS * 2 + 1;
export const LADDER_H = ROWS * ROW_H;
/** width of the centred price column */
export const PRICE_W = 118;
/** inset of the lots (and the spread row's words) from the screen edges */
export const EDGE = 20;
