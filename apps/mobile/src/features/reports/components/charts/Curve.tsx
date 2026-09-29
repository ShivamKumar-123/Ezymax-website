// Native: Skia is part of the app binary, the chart renders at once.
import * as React from "react";
import { CurveChart, type CurveSeries } from "./CurveChart";

export { CURVE_H } from "./layout";
export type { CurveSeries } from "./CurveChart";

export function Curve(props: { s: CurveSeries; width: number; fallback: React.ReactNode }) {
  return <CurveChart s={props.s} width={props.width} />;
}
