import { cn } from "@/lib/cn";

type StepCardProps = {
  step: string;
  title: string;
  body: string;
  className?: string;
};

export function StepCard({ step, title, body, className }: StepCardProps) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="flex items-start justify-between gap-4 border-t border-line pt-5">
        <h3 className="font-display text-lg font-semibold leading-tight text-ink">{title}</h3>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 font-mono text-sm text-orange-400">
          {step}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
