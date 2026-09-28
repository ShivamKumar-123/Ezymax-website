import { SearchX } from "lucide-react";
import { Card } from "@kalks/ui";
import { VerifyShell } from "@/components/prop-live/verify-shell";

export default function CertificateNotFound() {
  return (
    <VerifyShell>
      <Card className="mx-auto max-w-xl px-6 py-12 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full border border-line bg-surface-2 text-fg-2">
          <SearchX className="size-5" />
        </span>
        <h1 className="mt-4 text-[20px] font-medium tracking-tight">Certificate not found</h1>
        <p className="mt-2 text-[14px] text-fg-3">There is no Kalks Prop certificate with this number. Check the link or ask the trader to share it again.</p>
      </Card>
    </VerifyShell>
  );
}
