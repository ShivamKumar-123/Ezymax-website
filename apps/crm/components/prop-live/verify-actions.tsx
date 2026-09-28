"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Link2 } from "lucide-react";
import { Button } from "@kalks/ui";

/** Copy-link and download buttons on the public verify page. */
export function VerifyActions({ code }: { code: string }) {
  const copy = () => {
    const url = `${window.location.origin}/verify/${code}`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Link copied", { description: url }),
      () => toast.error("Couldn't copy the link", { description: url }),
    );
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="surface" onClick={copy}>
        <Link2 /> Copy link
      </Button>
      <a href={`/verify/${code}/image?download=1`} download={`kalks-certificate-${code}.png`}>
        <Button variant="ember">
          <Download /> Download PNG
        </Button>
      </a>
    </div>
  );
}
