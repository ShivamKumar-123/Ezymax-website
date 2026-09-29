// The ladder module (Skia) is loaded when the Depth screen first shows a book, not at app start.
import * as React from "react";
import type { LadderProps } from "./Ladder";

const Ladder = React.lazy(() => import("./Ladder").then((m) => ({ default: m.Ladder })));

export function LadderLazy(props: LadderProps & { fallback: React.ReactNode }) {
  const { fallback, ...rest } = props;
  return (
    <React.Suspense fallback={fallback}>
      <Ladder {...rest} />
    </React.Suspense>
  );
}
