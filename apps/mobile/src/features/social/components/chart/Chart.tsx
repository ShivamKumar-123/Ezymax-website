// Native: Skia is available at once.
import ChartCanvas from "./ChartCanvas";
import type { ChartProps } from "./types";

export type { ChartProps };
export function Chart(props: ChartProps) {
  return <ChartCanvas {...props} />;
}
