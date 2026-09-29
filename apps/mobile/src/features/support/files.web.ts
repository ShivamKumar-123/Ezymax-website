// Web preview: the browser's file picker, and a received file opens in a new tab (nothing is kept by the app).
import * as DocumentPicker from "expo-document-picker";
import { apiFile } from "@/lib/api";

export type Picked = { uri: string; name: string; mime: string; size?: number; blob?: Blob };

const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"];

export function mimeOf(name: string, fallback = "application/octet-stream"): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  return fallback;
}

async function pick(types: string[]): Promise<Picked | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: types, multiple: false });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  return { uri: a.uri, name: a.name, mime: a.mimeType || mimeOf(a.name), size: a.size, blob: a.file };
}

export const pickPhoto = (): Promise<Picked | null | "denied"> => pick(["image/png", "image/jpeg", "image/gif", "image/webp"]);
export const pickFile = (): Promise<Picked | null> => pick(ALLOWED);

export type Checked = { ok: true; blob: Blob } | { ok: false; reason: "type" | "size" };

export async function prepare(p: Picked, maxMb: number): Promise<Checked> {
  if (!ALLOWED.includes(p.mime)) return { ok: false, reason: "type" };
  const blob = p.blob ?? (await (await fetch(p.uri)).blob());
  if (blob.size > maxMb * 1024 * 1024) return { ok: false, reason: "size" };
  return { ok: true, blob };
}

export async function openAttachment(id: number, _name: string, mime: string, _dialogTitle: string): Promise<boolean> {
  const r = await apiFile(`support/attachments/${id}`, { timeoutMs: 60_000 });
  if (!r.ok) return false;
  const url = URL.createObjectURL(new Blob([r.data.bytes as BlobPart], { type: mime }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
