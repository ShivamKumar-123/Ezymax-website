import { LiveExam } from "@/components/academy/live/exam";

export default async function AcademyExamPage({ params }: { params: Promise<{ phase: string }> }) {
  const { phase } = await params;
  return <LiveExam phase={phase} />;
}
