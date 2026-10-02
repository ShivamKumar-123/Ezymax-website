"use client";

// Kalks FX Options: product overview, the 3-step onboarding (identity, risk disclosure, knowledge quiz) and the way
// into Kalks Trader in options mode. Live builds read the gateway (components/options/live.tsx); demo builds use
// local state (components/options/demo-page.tsx).

import { IS_DEMO } from "@kalks/mock/mode";
import { DemoOptions } from "@/components/options/demo-page";
import { LiveOptions } from "@/components/options/live";

export default function OptionsPage() {
  return IS_DEMO ? <DemoOptions /> : <LiveOptions />;
}
