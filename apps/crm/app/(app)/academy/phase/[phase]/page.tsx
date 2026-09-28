import { LivePhase } from "@/components/academy/live/phase";

export default async function AcademyPhasePage({ params }: { params: Promise<{ phase: string }> }) {
  const { phase } = await params;
  return <LivePhase slug={phase} />;
}
