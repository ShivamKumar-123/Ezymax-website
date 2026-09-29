// Certificates: the art's texts and sharing. The certificate itself is a document with a public verify link, so
// its texts stay English, exactly like the Client Area's certificate image (lib/prop-cert-image.tsx); the screens
// around it follow the reader's language.
import { Platform, Share } from "react-native";
import * as Sharing from "expo-sharing";
import { File as FsFile, Paths } from "expo-file-system";
import { API_BASE } from "@/lib/config";
import type { CertArtData } from "./components/gauges";
import type { Certificate } from "./types";

/** The public verify page on this broker's Client Area (the app's own server). */
export const verifyUrl = (code: string) => `${API_BASE}/verify/${encodeURIComponent(code)}`;

/** "$100,000" / "$1,234.56" (as on the web certificate). */
export function certMoney(v: number): string {
  const whole = Math.abs(v - Math.round(v)) < 0.005;
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
}

export function certHeadline(kind: Certificate["kind"]): string {
  return kind === "payout" ? "Certificate of Payout" : kind === "funded" ? "Funded Trader" : "Certificate of Achievement";
}

function certSub(c: Certificate): string {
  if (c.kind === "payout") return `Paid out on a ${certMoney(c.size)} ${c.planName} account`;
  if (c.kind === "funded") return `${certMoney(c.size)} funded account · ${c.planName}`;
  return `Passed ${c.phase ?? "the evaluation"} · ${certMoney(c.size)} account · ${c.planName}`;
}

function certDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${String(d.getUTCDate()).padStart(2, "0")} ${m} ${d.getUTCFullYear()}`;
}

/** Everything the certificate art prints. */
export function certArt(c: Certificate): CertArtData {
  const url = verifyUrl(c.code);
  return {
    kind: c.kind,
    code: c.code,
    headline: certHeadline(c.kind),
    amount: c.kind === "payout" && c.amount !== null ? certMoney(c.amount) : certMoney(c.size),
    sub: certSub(c),
    traderName: c.traderName,
    issued: `Issued ${certDate(c.issuedAt)}`,
    verifyText: `Verify at ${url.replace(/^https?:\/\//, "")}`,
    verifyUrl: url,
    revoked: c.revoked,
  };
}

/** Shares the certificate PNG (the system share sheet: Instagram, WhatsApp, Files…). False when sharing isn't possible. */
export async function sharePng(bytes: Uint8Array, code: string, title: string): Promise<boolean> {
  const name = `kalks-certificate-${code}.png`;
  if (Platform.OS === "web") {
    const blob = new Blob([bytes as BlobPart], { type: "image/png" });
    const nav = globalThis.navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    const file = new globalThis.File([blob], name, { type: "image/png" });
    if (nav?.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title });
      return true;
    }
    // desktop browsers (the preview): download it
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return true;
  }
  if (!(await Sharing.isAvailableAsync())) return false;
  const f = new FsFile(Paths.cache, name);
  f.create({ overwrite: true });
  f.write(bytes);
  await Sharing.shareAsync(f.uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: title });
  return true;
}

/** Shares the public verify link as text. */
export async function shareLink(code: string, message: string) {
  const url = verifyUrl(code);
  await Share.share(Platform.OS === "ios" ? { message, url } : { message: `${message}\n${url}` });
}
