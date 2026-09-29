// Web preview: the browser downloads the statement (no share sheet, nothing kept by the app).
import type { StFormat } from "./types";

export const MIME: Record<StFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

export function safeName(name: string | null, fallback: string, format: StFormat): string {
  const base =
    (name ?? fallback)
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^[-.]+/, "")
      .slice(0, 96) || fallback;
  return base.toLowerCase().endsWith(`.${format}`) ? base : `${base}.${format}`;
}

export async function saveAndShare(bytes: Uint8Array, name: string, format: StFormat, _dialogTitle: string): Promise<{ how: "shared" | "saved"; name: string }> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[format] }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { how: "saved", name };
}

export function clearSavedStatements() {}
