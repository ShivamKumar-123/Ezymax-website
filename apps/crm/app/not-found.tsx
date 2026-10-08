import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@ezymex/ui/logo";
import { Illustration } from "@ezymex/ui/illustration";
import { getT } from "@ezymex/i18n/server";

export const metadata: Metadata = { title: "Not found" };

/** 404 for any address the Client Area doesn't have. The art stays lazy: this boundary rides along in every page's
 *  payload, and a priority image would be preloaded on every page. */
export default async function NotFound() {
  const t = await getT();
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
      <div className="max-w-md text-center">
        <Logo height={26} className="mx-auto" />
        <Illustration name="market" width={220} maxHeight={200} className="mx-auto mt-10" />
        <h1 className="mt-8 text-[28px] font-medium tracking-[-0.02em]" data-testid="not-found-title">
          {t("shell.system.notFound.title")}
        </h1>
        <p className="mt-3 text-[15px] text-fg-2">{t("shell.system.notFound.text")}</p>
        <Link href="/" className="mt-8 inline-block text-[13.5px] text-ember hover:underline">
          {t("shell.system.unavailable.back")}
        </Link>
      </div>
    </main>
  );
}
