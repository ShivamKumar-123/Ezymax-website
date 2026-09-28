import { Suspense } from "react";
import { Splash, Terminal } from "@/components/terminal";

export default function TerminalPage() {
  return (
    <Suspense fallback={<Splash />}>
      <Terminal />
    </Suspense>
  );
}
