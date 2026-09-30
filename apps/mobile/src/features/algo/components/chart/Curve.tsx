// Native: Skia is part of the app binary, the curve renders at once.
import * as React from "react";
import CurveCanvas from "./CurveCanvas";
import type { CurveData, CurveLayout } from "./types";

export function Curve(props: { d: CurveData; width: number; layout: CurveLayout; fallback: React.ReactNode; testID?: string }) {
  return <CurveCanvas d={props.d} width={props.width} layout={props.layout} testID={props.testID} />;
}
