// Copy and share for partner links, QR codes and share cards: the system share sheet (WhatsApp, Telegram, Mail…),
// the clipboard, and PNG files through expo-sharing (the web preview uses the Web Share API or a download).
import { Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { File as FsFile, Paths } from "expo-file-system";
import { haptic } from "@/lib/haptics";
import { toast } from "@/ui";

/** Copies `value` and confirms with a short toast. */
export async function copyText(value: string, title: string, body?: string) {
  const ok = await Clipboard.setStringAsync(value).then(
    () => true,
    () => false,
  );
  if (ok) {
    haptic.select();
    toast.show({ title, body, tone: "success" });
  }
  return ok;
}

/** Opens the system share sheet with a message and a link (iOS takes the URL separately; Android wants it in the text). */
export async function shareLink(url: string, message: string, title?: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) {
        await nav.share({ title, text: message, url });
        return true;
      }
      return false;
    }
    const r = await Share.share(Platform.OS === "ios" ? { message, url, title } : { message: `${message}\n${url}`, title }, { dialogTitle: title, subject: title });
    return r.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}

/** Shares a PNG through the share sheet (Instagram, WhatsApp, Files…); the web preview shares or downloads it. */
export async function sharePng(bytes: Uint8Array, fileName: string, title: string): Promise<boolean> {
  if (Platform.OS === "web") {
    const blob = new Blob([bytes as BlobPart], { type: "image/png" });
    const nav = globalThis.navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    const file = new globalThis.File([blob], fileName, { type: "image/png" });
    try {
      if (nav?.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title });
        return true;
      }
    } catch {
      return false;
    }
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return true;
  }
  if (!(await Sharing.isAvailableAsync())) return false;
  const f = new FsFile(Paths.cache, fileName);
  f.create({ overwrite: true });
  f.write(bytes);
  await Sharing.shareAsync(f.uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: title });
  return true;
}

/** Downloads a public image (a share card PNG) and shares it as a file. */
export async function shareRemotePng(url: string, fileName: string, title: string): Promise<boolean> {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return false;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return await sharePng(bytes, fileName, title);
  } catch {
    return false;
  }
}
