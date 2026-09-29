// Getting a document into the app (guided camera, photo library, files) and sending it to the KYC BFF
// (/api/mobile/kyc/documents -> /api/kyc/documents -> gateway, encrypted at rest there). Photos are checked on the
// phone first (checks.ts); the upload carries those results for the reviewer, exactly like the Client Area.
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { apiUpload, type ApiResult } from "@/lib/api";
import { analyzePixels, issueDateCheck, skippedChecks } from "./checks";
import { fileSize, readPixels, shrinkJpeg, type Crop } from "./pixels";
import { MAX_BYTES, MIN_BYTES, type ClientChecks, type KycDocument, type KycState, type Purpose, type Slot } from "./types";

export type Picked = {
  uri: string;
  name: string;
  mime: string;
  size?: number;
  width?: number;
  height?: number;
  origin: "camera" | "file";
  /** web preview: the chosen File itself */
  blob?: Blob;
  /** camera: the part of the photo inside the on-screen guide (normalised) */
  crop?: Crop;
};

const isImage = (mime: string) => mime.startsWith("image/");
const isHeic = (mime: string) => /hei[cf]/i.test(mime);

function extOf(mime: string) {
  return mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : isHeic(mime) ? "heic" : "jpg";
}

function mimeOf(name: string | null | undefined, fallback = "image/jpeg") {
  const n = (name ?? "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".heic") || n.endsWith(".heif")) return "image/heic";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  return fallback;
}

/** A photo from the library. "denied" when the app may not read the library. */
export async function pickPhoto(purpose: Purpose): Promise<Picked | null | "denied"> {
  try {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: false, exif: false, selectionLimit: 1 });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    const mime = a.mimeType ?? mimeOf(a.fileName);
    return { uri: a.uri, name: a.fileName || `${purpose}-${Date.now()}.${extOf(mime)}`, mime, size: a.fileSize, width: a.width, height: a.height, origin: "file", blob: (a as { file?: Blob }).file };
  } catch (e) {
    return String((e as Error)?.message ?? "").toLowerCase().includes("permission") ? "denied" : null;
  }
}

/** A file (PDF or image) from the Files app / Drive. */
export async function pickFile(purpose: Purpose): Promise<Picked | null> {
  const types = purpose === "selfie" ? ["image/jpeg", "image/png", "image/heic", "image/heif"] : ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"];
  const r = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const mime = a.mimeType || mimeOf(a.name, "application/octet-stream");
  return { uri: a.uri, name: a.name || `${purpose}-${Date.now()}.${extOf(mime)}`, mime, size: a.size, origin: "file", blob: a.file };
}

export type Prepared = { file: Picked; checks: ClientChecks } | { error: "tooLarge" | "tooSmall" | "format" | "selfiePhoto" };

/** Size limits, a smaller copy of an over-limit photo, and the instant checks. */
export async function prepare(p: Picked, purpose: Purpose, opts: { passport?: boolean; issueDate?: string } = {}): Promise<Prepared> {
  let file = { ...p };
  if (file.mime === "application/pdf" && purpose === "selfie") return { error: "selfiePhoto" };
  if (file.mime !== "application/pdf" && !isImage(file.mime)) return { error: "format" };
  if (file.size === undefined && Platform.OS !== "web") file.size = fileSize(file.uri);
  if (file.size === undefined && file.blob) file.size = file.blob.size;
  // a photo over the limit gets a smaller JPEG copy (documents stay sharp at 3200 px); PDFs can't be shrunk here
  if (file.size !== undefined && file.size > MAX_BYTES) {
    if (!isImage(file.mime) || isHeic(file.mime)) return { error: "tooLarge" };
    const small = await shrinkJpeg(file.uri);
    if (!small || small.size > MAX_BYTES) return { error: "tooLarge" };
    file = { ...file, uri: small.uri, size: small.size, width: small.width, height: small.height, mime: "image/jpeg", name: file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", blob: undefined };
  }
  if (file.size !== undefined && file.size < MIN_BYTES) return { error: "tooSmall" };

  let checks: ClientChecks;
  if (file.mime === "application/pdf") checks = skippedChecks(file.origin, "pdf");
  else if (isHeic(file.mime)) checks = skippedChecks(file.origin, "heic", file.width && file.height ? { w: file.width, h: file.height } : undefined);
  else {
    const px = await readPixels(file.uri, file.crop);
    if (px) {
      const sw = file.width ?? px.sw;
      const sh = file.height ?? px.sh;
      checks = analyzePixels(px.data, px.w, px.h, { sw, sh, purpose, passport: opts.passport, origin: file.origin });
      file.width = sw;
      file.height = sh;
    } else checks = skippedChecks(file.origin, "format", file.width && file.height ? { w: file.width, h: file.height } : undefined);
  }
  if (opts.issueDate) checks.issue_date = issueDateCheck(opts.issueDate);
  return { file, checks };
}

export type UploadResult = { status: "ok"; document: KycDocument; state: KycState };

/** Multipart upload with progress; the answer carries the new verification state. */
export async function uploadDocument(slot: Slot, file: Picked, opts: { checks?: ClientChecks | null; issueDate?: string; docType?: string; onProgress?: (pct: number) => void }): Promise<ApiResult<UploadResult>> {
  const fd = new FormData();
  if (Platform.OS === "web") {
    const blob = file.blob ?? (await (await fetch(file.uri)).blob());
    fd.append("file", blob, file.name);
  } else {
    fd.append("file", { uri: file.uri, name: file.name, type: file.mime } as unknown as Blob);
  }
  fd.append("kind", slot.kind);
  fd.append("side", slot.side);
  if (slot.party) fd.append("party", slot.party);
  if (opts.issueDate) fd.append("issue_date", opts.issueDate);
  if (opts.docType) fd.append("doc_type", opts.docType);
  if (opts.checks) fd.append("checks", JSON.stringify(opts.checks));
  return apiUpload<UploadResult>("kyc/documents", fd, { onProgress: opts.onProgress, timeoutMs: 180_000 });
}
