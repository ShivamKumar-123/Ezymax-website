import { Suspense } from "react";
import { LiveGlossary } from "@/components/academy/live/glossary";

export default function AcademyGlossaryPage() {
  return (
    <Suspense>
      <LiveGlossary />
    </Suspense>
  );
}
