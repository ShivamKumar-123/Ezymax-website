import { ImageResponse } from "next/og";
import { site } from "@/content/site";
import { LOGO_PATH, LOGO_VIEWBOX } from "@/components/ui/Logo";

export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
            background: "radial-gradient(circle at 40% 40%, rgba(255,106,0,0.55), rgba(122,15,15,0.35) 55%, rgba(6,6,6,0) 75%)",
            filter: "blur(40px)",
          }}
        />
        <div style={{ position: "absolute", top: 36, left: 56, color: "#ff8a3d", fontSize: 18, letterSpacing: 4 }}>[ BROKERAGE TECHNOLOGY PARTNER ]</div>
        <div style={{ position: "absolute", top: 36, right: 56, color: "#ff8a3d", fontSize: 18, letterSpacing: 4 }}>[ SETUPZERO ]</div>
        <svg viewBox={LOGO_VIEWBOX} width={720} height={136} style={{ position: "relative" }}>
          <path fill="#f3efe9" fillRule="evenodd" d={LOGO_PATH} />
        </svg>
        <div style={{ marginTop: 36, color: "#a39e98", fontSize: 30, letterSpacing: 1 }}>{site.tagline}</div>
        <div style={{ position: "absolute", bottom: 40, display: "flex", gap: 28, color: "#6f6a66", fontSize: 18, letterSpacing: 2 }}>
          <span>CFD WHITE LABEL</span>
          <span>·</span>
          <span>PROP FIRM TECH</span>
          <span>·</span>
          <span>FOREX CRM</span>
          <span>·</span>
          <span>LIQUIDITY</span>
          <span>·</span>
          <span>24/7 SUPPORT</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
