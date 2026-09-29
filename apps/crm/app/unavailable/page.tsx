import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@kalks/ui/logo";
import { getT } from "@kalks/i18n/server";

export const metadata: Metadata = { title: "Not available" };

/** A module the broker has switched off (the proxy rewrites its pages here). */
export default async function UnavailablePage() {
  const t = await getT();
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
      <div className="max-w-md text-center">
        <Logo height={26} className="mx-auto" />
        <h1 className="mt-10 text-[28px] font-medium tracking-[-0.02em]" data-testid="unavailable-title">
          {t("shell.system.unavailable.title")}
        </h1>
        <p className="mt-3 text-[15px] text-fg-2">{t("shell.system.unavailable.text")}</p>
        <Link href="/" className="mt-8 inline-block text-[13.5px] text-ember hover:underline">
          {t("shell.system.unavailable.back")}
        </Link>
      </div>
    </main>
  );
}
