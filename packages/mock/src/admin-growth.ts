/**
 * Back Office "growth" mock data (Marketing, Support, Content, Analytics).
 * Import via `@ezymex/mock/admin-growth` (or a sub-file, e.g. `@ezymex/mock/admin-growth-marketing`).
 * Every export is module-prefixed (MKT_, SUP_, CNT_, ANL_) so the barrel never collides.
 */
export * from "./admin-growth-marketing";
export * from "./admin-growth-support";
export * from "./admin-growth-content";
export * from "./admin-growth-analytics";
