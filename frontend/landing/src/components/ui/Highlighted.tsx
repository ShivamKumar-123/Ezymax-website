import { Fragment } from "react";

/** Renders `text` with `highlight` (if present inside it) wrapped in the orange gradient. */
export function Highlighted({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight || !text.includes(highlight)) return <>{text}</>;
  const parts = text.split(highlight);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 ? <span className="highlight">{highlight}</span> : null}
        </Fragment>
      ))}
    </>
  );
}
