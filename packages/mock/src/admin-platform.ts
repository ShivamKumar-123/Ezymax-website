/**
 * Back Office "platform" mock data (Security, Organization, Brokers, Settings).
 * Import via `@ezymex/mock/admin-platform` (or a sub-file, e.g. `@ezymex/mock/admin-platform-settings`).
 * Every export is module-prefixed (SEC_/ORG_, BRK_, SET_) so the barrel never collides.
 */
export * from "./admin-platform-security";
export * from "./admin-platform-brokers";
export * from "./admin-platform-settings";
