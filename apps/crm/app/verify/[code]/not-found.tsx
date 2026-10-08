import { Card } from "@ezymex/ui/primitives";
import { Illustration } from "@ezymex/ui/illustration";
import { getT } from "@ezymex/i18n/server";
import { VerifyShell } from "@/components/prop-live/verify-shell";

export default async function CertificateNotFound() {
  const t = await getT();
  return (
    <VerifyShell>
      <Card className="mx-auto max-w-xl px-6 py-12 text-center">
        <Illustration name="market" width={176} maxHeight={150} className="mx-auto" />
        <h1 className="mt-6 text-[20px] font-medium tracking-tight">{t("prop.verify.notFoundTitle")}</h1>
        <p className="mt-2 text-[14px] text-fg-3">{t("prop.verify.notFoundText")}</p>
      </Card>
    </VerifyShell>
  );
}
