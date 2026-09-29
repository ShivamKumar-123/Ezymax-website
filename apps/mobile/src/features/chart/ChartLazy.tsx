// The chart module (Skia + its maths) is loaded after the first paint of the Trade tab, not at app start.
import * as React from "react";
import type { ChartViewProps } from "./ChartView";

const ChartView = React.lazy(() => import("./ChartView").then((m) => ({ default: m.ChartView })));

export function ChartLazy(props: ChartViewProps & { fallback: React.ReactNode }) {
  const { fallback, ...rest } = props;
  return (
    <React.Suspense fallback={fallback}>
      <ChartView {...rest} />
    </React.Suspense>
  );
}
