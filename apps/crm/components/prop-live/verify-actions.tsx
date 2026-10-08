"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Link2 } from "lucide-react";
import { Button } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";

/** Copy-link and download buttons on the public verify page. */
export function VerifyActions({ code }: { code: string }) {
  const t = useT();
  const copy = () => {
    const url = `${window.location.origin}/verify/${code}`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success(t("prop.verify.linkCopied"), { description: url }),
      () => toast.error(t("prop.verify.copyFailed"), { description: url }),
    );
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="surface" onClick={copy}>
        <Link2 /> {t("prop.verify.copyLink")}
      </Button>
      <a href={`/verify/${code}/image?download=1`} download={`ezymex-certificate-${code}.png`}>
        <Button variant="ember">
          <Download /> {t("prop.verify.downloadPng")}
        </Button>
      </a>
    </div>
  );
}
