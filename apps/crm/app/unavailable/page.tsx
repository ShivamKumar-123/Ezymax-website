import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@kalks/ui";

export const metadata: Metadata = { title: "Not available" };

/** A module the broker has switched off (the proxy rewrites its pages here). */
export default function UnavailablePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
      <div className="max-w-md text-center">
        <Logo height={26} className="mx-auto" />
        <h1 className="mt-10 text-[28px] font-medium tracking-[-0.02em]" data-testid="unavailable-title">
          Not available
        </h1>
        <p className="mt-3 text-[15px] text-fg-2">This section isn&apos;t offered on your account. Contact support if you think this is a mistake.</p>
        <Link href="/" className="mt-8 inline-block text-[13.5px] text-ember hover:underline">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
