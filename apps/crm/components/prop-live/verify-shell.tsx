import Link from "next/link";
import { Logo } from "@ezymex/ui/logo";
import { getT } from "@ezymex/i18n/server";

/** Standalone branded frame for the public certificate pages (no Client Area shell, no sign-in). */
export async function VerifyShell({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Ezymex" className="flex items-center gap-3">
            <Logo height={20} className="text-fg" />
            <span className="hidden text-[13px] text-fg-3 sm:inline">{t("prop.verify.shellTitle")}</span>
          </Link>
          <Link href="/prop" className="text-[13px] text-fg-2 hover:text-fg">
            Ezymex Prop
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-[12px] text-fg-3 sm:px-6">
        {t("prop.verify.footer")}
      </footer>
    </div>
  );
}
