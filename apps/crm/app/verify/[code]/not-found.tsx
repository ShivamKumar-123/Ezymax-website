import { SearchX } from "lucide-react";
import { Card } from "@kalks/ui";
import { getT } from "@kalks/i18n/server";
import { VerifyShell } from "@/components/prop-live/verify-shell";

export default async function CertificateNotFound() {
  const t = await getT();
  return (
    <VerifyShell>
      <Card className="mx-auto max-w-xl px-6 py-12 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full border border-line bg-surface-2 text-fg-2">
          <SearchX className="size-5" />
        </span>
        <h1 className="mt-4 text-[20px] font-medium tracking-tight">{t("prop.verify.notFoundTitle")}</h1>
        <p className="mt-2 text-[14px] text-fg-3">{t("prop.verify.notFoundText")}</p>
      </Card>
    </VerifyShell>
  );
}
