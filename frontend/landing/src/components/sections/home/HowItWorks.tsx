import { howItWorks } from "@/content/home";
import { Timeline } from "@/components/sections/shared/Timeline";

export function HowItWorks() {
  return (
    <Timeline
      eyebrow={howItWorks.eyebrow}
      heading={howItWorks.heading}
      highlight={howItWorks.highlight}
      sub="A clear path from first call to go-live, with our team on hand at every step."
      steps={howItWorks.steps}
      className="py-20 md:py-28"
    />
  );
}
