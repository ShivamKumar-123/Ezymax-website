import { LiveChapter } from "@/components/academy/live/reader";

export default async function AcademyChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LiveChapter slug={slug} />;
}
