"use client";

import * as React from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, cn } from "@kalks/ui";
import { tr, useT } from "@kalks/i18n/react";
import { shortUrl } from "./api";

export type QrTheme = "light" | "dark";
export const QR_COLORS: Record<QrTheme, { fg: string; bg: string }> = {
  light: { fg: "#0b0b0e", bg: "#ffffff" },
  dark: { fg: "#ffffff", bg: "#111114" },
};

/** The Kalks mark as a data URL in `color`, so it survives SVG export and canvas rendering. */
function useMark(color: string, enabled: boolean) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    let stop = false;
    fetch("/assets/brand/kalks-mark.svg")
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("mark"))))
      .then((svg) => {
        if (stop) return;
        const tinted = svg.replace(/currentColor/g, color);
        setUrl(
          `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(tinted)))}`,
        );
      })
      .catch(() => !stop && setUrl(null));
    return () => {
      stop = true;
    };
  }, [color, enabled]);
  return enabled ? url : null;
}

function save(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const EXPORT_PX = 1024;

/**
 * Hook: QR code with working SVG / PNG downloads. The visible code is an SVG; the PNG comes from a hidden
 * high-resolution canvas rendered from the same value.
 */
export function useQrCode({
  value,
  size,
  theme = "light",
  logo = true,
  fileBase,
  className,
}: {
  value: string;
  size: number;
  theme?: QrTheme;
  logo?: boolean;
  fileBase: string;
  className?: string;
}) {
  const { fg, bg } = QR_COLORS[theme];
  const mark = useMark(fg, logo);
  const exportBox = React.useRef<HTMLDivElement>(null);
  const img = (px: number) =>
    mark
      ? { src: mark, width: px * 0.2, height: px * 0.2, excavate: true }
      : undefined;

  const downloadSvg = React.useCallback(() => {
    const svg = exportBox.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const text = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
    const url = URL.createObjectURL(
      new Blob([text], { type: "image/svg+xml" }),
    );
    save(url, `${fileBase}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast.success(tr("partner.qr.saved"), { description: `${fileBase}.svg` });
  }, [fileBase]);

  const downloadPng = React.useCallback(() => {
    const canvas = exportBox.current?.querySelector("canvas");
    if (!canvas) return;
    try {
      save(canvas.toDataURL("image/png"), `${fileBase}.png`);
      toast.success(tr("partner.qr.saved"), {
        description: `${fileBase}.png · ${EXPORT_PX}×${EXPORT_PX}`,
      });
    } catch {
      toast.error(tr("partner.qr.pngFailed"), {
        description: tr("partner.qr.pngFailedHint"),
      });
    }
  }, [fileBase]);

  return {
    view: (
      <div
        className={cn("inline-block rounded-[16px] p-3.5", className)}
        style={{ background: bg }}
      >
        <div className="leading-none">
          <QRCodeSVG
            value={value}
            size={size}
            level="H"
            marginSize={0}
            fgColor={fg}
            bgColor={bg}
            imageSettings={img(size)}
            title={shortUrl(value)}
          />
        </div>
        {/* export copies: with a quiet zone, at print size */}
        <div ref={exportBox} className="hidden" aria-hidden>
          <QRCodeSVG
            value={value}
            size={EXPORT_PX}
            level="H"
            marginSize={4}
            fgColor={fg}
            bgColor={bg}
            imageSettings={img(EXPORT_PX)}
          />
          <QRCodeCanvas
            value={value}
            size={EXPORT_PX}
            level="H"
            marginSize={4}
            fgColor={fg}
            bgColor={bg}
            imageSettings={img(EXPORT_PX)}
          />
        </div>
      </div>
    ),
    downloadSvg,
    downloadPng,
  };
}

/** A simple dialog: QR for one link, with SVG and PNG downloads. */
export function QrDialog({
  open,
  onOpenChange,
  value,
  title,
  fileBase,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  value: string;
  title: string;
  fileBase: string;
}) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={400}
      title={title}
      description={t("partner.qr.dialogDescription")}
    >
      {open ? <QrDialogBody value={value} fileBase={fileBase} /> : <div />}
    </Dialog>
  );
}

function QrDialogBody({
  value,
  fileBase,
}: {
  value: string;
  fileBase: string;
}) {
  const qr = useQrCode({ value, size: 220, fileBase });
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-[20px] border border-line p-2">{qr.view}</div>
      <div className="max-w-full truncate font-mono text-[12.5px] text-fg-2">
        {shortUrl(value)}
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <Button variant="surface" size="sm" onClick={qr.downloadSvg}>
          <Download /> SVG
        </Button>
        <Button variant="ember" size="sm" onClick={qr.downloadPng}>
          <Download /> PNG
        </Button>
      </div>
    </div>
  );
}
