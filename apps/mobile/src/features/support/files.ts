// Chat attachments on the phone: pick a photo (library) or a file (PDF / image), check it like the service does
// (PNG, JPG, GIF, WEBP or PDF, up to the broker's size limit), upload it as the request body, and open a received
// file (written to the app cache, then the share sheet: Quick Look / Files / another app). Cached files are
// removed on sign-out: attachments can be personal documents.
import { Directory, File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { apiFile } from "@/lib/api";
import { onSignOut } from "@/session";

export type Picked = { uri: string; name: string; mime: string; size?: number; blob?: Blob };

const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"];

export function mimeOf(name: string, fallback = "application/octet-stream"): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".heic") || n.endsWith(".heif")) return "image/heic";
  return fallback;
}

const extOf = (mime: string) => (mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/gif" ? "gif" : mime === "image/webp" ? "webp" : "jpg");

/** A photo from the library, as JPEG when the phone stores HEIC ("denied" without permission). */
export async function pickPhoto(): Promise<Picked | null | "denied"> {
  try {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
      exif: false,
      selectionLimit: 1,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    const mime = a.mimeType ?? mimeOf(a.fileName ?? "", "image/jpeg");
    return { uri: a.uri, name: a.fileName || `photo-${Date.now()}.${extOf(mime)}`, mime, size: a.fileSize, blob: (a as { file?: Blob }).file };
  } catch (e) {
    return String((e as Error)?.message ?? "").toLowerCase().includes("permission") ? "denied" : null;
  }
}

/** A PDF or an image from Files / Drive. */
export async function pickFile(): Promise<Picked | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ALLOWED, copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const mime = a.mimeType || mimeOf(a.name);
  return { uri: a.uri, name: a.name || `file-${Date.now()}.${extOf(mime)}`, mime, size: a.size, blob: a.file };
}

export type Checked = { ok: true; blob: Blob } | { ok: false; reason: "type" | "size" };

/** The service's rules, checked before anything is sent. */
export async function prepare(p: Picked, maxMb: number): Promise<Checked> {
  if (!ALLOWED.includes(p.mime)) return { ok: false, reason: "type" };
  if (p.size !== undefined && p.size > maxMb * 1024 * 1024) return { ok: false, reason: "size" };
  const blob = p.blob ?? (await (await fetch(p.uri)).blob());
  if (blob.size > maxMb * 1024 * 1024) return { ok: false, reason: "size" };
  return { ok: true, blob };
}

const dir = () => new Directory(Paths.cache, "support");

function safe(name: string, mime: string): string {
  const base =
    name
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^[-.]+/, "")
      .slice(0, 96) || `attachment.${extOf(mime)}`;
  return /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.${extOf(mime)}`;
}

/** Downloads an attachment and opens it in the share sheet (Quick Look, Files, another app). */
export async function openAttachment(id: number, name: string, mime: string, dialogTitle: string): Promise<boolean> {
  const r = await apiFile(`support/attachments/${id}`, { timeoutMs: 60_000 });
  if (!r.ok) return false;
  const folder = dir();
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, `${id}-${safe(name, mime)}`);
  file.create({ overwrite: true });
  file.write(r.data.bytes);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle, UTI: mime === "application/pdf" ? "com.adobe.pdf" : undefined });
  return true;
}

onSignOut(() => {
  try {
    const folder = dir();
    if (folder.exists) folder.delete();
  } catch {
    // the cache is the OS's to purge anyway
  }
});
