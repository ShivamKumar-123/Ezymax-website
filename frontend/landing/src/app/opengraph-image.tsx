import { ImageResponse } from "next/og";

import { facts } from "@/content/facts";
import { site } from "@/content/site";

export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share card.
 *
 * The wordmark is set as text rather than drawn. Satori — what `ImageResponse`
 * renders with — cannot load a local PNG by path, and the previous version got
 * around that by inlining an SVG path that spelled out the old brand. Text is
 * the honest replacement: it stays correct when the logo artwork is replaced,
 * and there is no second copy of the name to forget about.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#060606",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 760,
            height: 560,
            borderRadius: 9999,
            background:
              "radial-gradient(circle at 40% 40%, rgba(255,106,0,0.55), rgba(122,15,15,0.35) 55%, rgba(6,6,6,0) 75%)",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 36,
            left: 56,
            color: "#ff8a3d",
            fontSize: 18,
            letterSpacing: 4,
          }}
        >
          {`[ ${site.tagline.replace(/\.$/, "").toUpperCase()} ]`}
        </div>
        {/* The domain, not a second rendering of the name: the brand and the
            address are spelled differently, and showing both without context
            reads as a typo on a share card. */}
        <div
          style={{
            position: "absolute",
            top: 36,
            right: 56,
            color: "#ff8a3d",
            fontSize: 18,
            letterSpacing: 4,
          }}
        >
          {`[ ${site.domain.toUpperCase()} ]`}
        </div>

        <div
          style={{
            position: "relative",
            color: "#f3efe9",
            fontSize: 128,
            fontWeight: 700,
            letterSpacing: -2,
          }}
        >
          {site.name}
        </div>

        <div
          style={{
            marginTop: 20,
            color: "#a39e98",
            fontSize: 30,
            letterSpacing: 1,
          }}
        >
          CFDs on forex, indices, commodities and crypto
        </div>

        {/* Published platform rules rather than a feature list -- these are
            the only numbers this site is allowed to state. See content/facts.ts. */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            gap: 28,
            color: "#6f6a66",
            fontSize: 18,
            letterSpacing: 2,
          }}
        >
          <span>{facts.defaultLeverage} LEVERAGE</span>
          <span>·</span>
          <span>MARGIN CALL {facts.marginCallLevel}</span>
          <span>·</span>
          <span>STOP-OUT {facts.stopOutLevel}</span>
          <span>·</span>
          <span>INVITE ONLY</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
