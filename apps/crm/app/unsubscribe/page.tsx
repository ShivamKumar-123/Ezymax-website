import type { Metadata } from "next";
import { UnsubscribeCard } from "./unsubscribe-card";

export const metadata: Metadata = { title: "Email preferences", robots: { index: false } };

/** Target of the unsubscribe link in marketing emails (`/unsubscribe?u=<user>&s=<signature>`). */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const u = typeof q.u === "string" ? q.u : "";
  const s = typeof q.s === "string" ? q.s : "";
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
      <UnsubscribeCard u={u} s={s} />
    </main>
  );
}
