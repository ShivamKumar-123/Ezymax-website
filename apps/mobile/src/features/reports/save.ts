// Statement files on the phone: written to the app's cache (reports/), then handed to the native share sheet
// (Save to Files, Mail, Drive, WhatsApp…). The cache folder is emptied on sign-out: statements are personal data.
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { StFormat } from "./types";

export const MIME: Record<StFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};
const UTI: Record<StFormat, string> = { pdf: "com.adobe.pdf", xlsx: "org.openxmlformats.spreadsheetml.sheet", csv: "public.comma-separated-values-text" };

const dir = () => new Directory(Paths.cache, "reports");

/** A safe file name (the service sends kalks-statement-<login>-<from>-<to>.<ext>). */
export function safeName(name: string | null, fallback: string, format: StFormat): string {
  const base =
    (name ?? fallback)
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^[-.]+/, "")
      .slice(0, 96) || fallback;
  return base.toLowerCase().endsWith(`.${format}`) ? base : `${base}.${format}`;
}

/** Writes the file and opens the share sheet. "shared" once the sheet closes, "saved" when sharing is unavailable. */
export async function saveAndShare(bytes: Uint8Array, name: string, format: StFormat, dialogTitle: string): Promise<{ how: "shared" | "saved"; name: string }> {
  const folder = dir();
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, name);
  file.create({ overwrite: true });
  file.write(bytes);
  if (!(await Sharing.isAvailableAsync())) return { how: "saved", name };
  await Sharing.shareAsync(file.uri, { mimeType: MIME[format], UTI: UTI[format], dialogTitle });
  return { how: "shared", name };
}

/** Sign-out: remove every statement kept on the phone. */
export function clearSavedStatements() {
  try {
    const folder = dir();
    if (folder.exists) folder.delete();
  } catch {
    // the cache is the OS's to purge anyway
  }
}
