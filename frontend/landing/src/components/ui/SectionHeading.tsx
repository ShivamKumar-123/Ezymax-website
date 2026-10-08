import { cn } from "@/lib/cn";
import { Badge } from "./Badge";
import { Highlighted } from "./Highlighted";

type SectionHeadingProps = {
  eyebrow?: string;
  heading: string;
  highlight?: string;
  sub?: string;
  align?: "left" | "center";
  size?: "md" | "lg";
  className?: string;
  as?: "h1" | "h2";
};

export function SectionHeading({
  eyebrow,
  heading,
  highlight,
  sub,
  align = "left",
  size = "md",
  className,
  as: Tag = "h2",
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? <Badge variant="bracket">{eyebrow}</Badge> : null}
      <Tag
        className={cn(
          "font-display font-semibold text-ink",
          size === "lg"
            ? "text-4xl leading-[1.02] sm:text-5xl md:text-6xl"
            : "text-3xl leading-[1.05] sm:text-4xl md:text-[44px]",
        )}
      >
        <Highlighted text={heading} highlight={highlight} />
      </Tag>
      {sub ? (
        <p className={cn("max-w-2xl text-base leading-relaxed text-muted md:text-lg")}>{sub}</p>
      ) : null}
    </div>
  );
}
