// Copies shared brand/photo/icon assets into each app's public/assets folder.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const app of ["crm", "admin", "terminal"]) {
  const dest = join(root, "apps", app, "public", "assets");
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(join(root, "assets"), dest, { recursive: true });
}
console.log("assets synced");
