"use client";

import { useParams } from "next/navigation";
import { UpdateDetail } from "@/components/growth/updates";

/** One event or brand post: image, time and place, and its body (markdown rendered as text, never HTML). */
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <UpdateDetail id={id} />;
}
