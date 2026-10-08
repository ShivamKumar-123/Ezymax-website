import type { Metadata } from "next";
import { Logo } from "@ezymex/ui/logo";
import { getT } from "@ezymex/i18n/server";

export const metadata: Metadata = { title: "Staff session" };

/** Where a staff session ("Log in as client" from the Back Office) lands when it ends or its link has expired. */
export default async function StaffSessionPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const t = await getT();
  const state = (await searchParams).state === "expired" ? "expired" : "ended";
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
      <div className="max-w-md text-center">
        <Logo height={26} className="mx-auto" />
        <h1 className="mt-10 text-[26px] font-medium tracking-[-0.02em]" data-testid="staff-session-state" data-state={state}>
          {t(`security.staff.${state}.title`)}
        </h1>
        <p className="mt-3 text-[15px] text-fg-2">{t(`security.staff.${state}.text`)}</p>
      </div>
    </main>
  );
}
