import { howItWorks } from "@/content/home";
import { Timeline } from "@/components/sections/shared/Timeline";

export function HowItWorks() {
  return (
    <Timeline
      eyebrow={howItWorks.eyebrow}
      heading={howItWorks.heading}
      highlight={howItWorks.highlight}
      sub={howItWorks.sub}
      steps={howItWorks.steps}
      className="py-20 md:py-28"
    />
  );
}
