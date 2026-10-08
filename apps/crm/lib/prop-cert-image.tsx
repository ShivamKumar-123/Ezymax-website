import { ImageResponse } from "next/og";
import { certBig, certDate, certHeadline, certSub, type PublicCertificate } from "@/lib/prop";

/** Certificate PNG (1200 × 675), same layout as the service's SVG (services/prop/src/certs.rs). */
export function certImage(c: PublicCertificate, verify: string): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 675, display: "flex", background: "#0b0b0d", padding: 24, fontFamily: "sans-serif" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", background: "#121215", border: "1px solid #2a2a30", borderRadius: 28, overflow: "hidden", padding: "0 56px" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: "#ff5a1f" }} />
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 58 }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: "#f5f5f6", letterSpacing: 1 }}>EZYMEX</span>
              <span style={{ fontSize: 18, color: "#9a9aa3", marginLeft: 14 }}>PROP</span>
            </div>
            <span style={{ fontSize: 16, color: "#9a9aa3" }}>{`No. ${c.code}`}</span>
          </div>
          <div style={{ display: "flex", marginTop: 62, fontSize: 22, color: "#ff8a3d", letterSpacing: 3 }}>{certHeadline(c.kind).toUpperCase()}</div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 56, fontWeight: 600, color: "#f5f5f6" }}>{c.traderName}</div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 92, fontWeight: 700, color: "#f5f5f6", lineHeight: 1 }}>{certBig(c)}</div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 24, color: "#c4c4cc" }}>{certSub(c)}</div>
          <div style={{ display: "flex", marginTop: "auto", borderTop: "1px solid #2a2a30", paddingTop: 30, paddingBottom: 38, justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 16, color: "#9a9aa3" }}>Issued</span>
              <span style={{ fontSize: 22, color: "#f5f5f6", marginTop: 8 }}>{certDate(c.issuedAt)}</span>
            </div>
            {!c.valid && <span style={{ fontSize: 20, fontWeight: 600, color: "#f04438" }}>REVOKED</span>}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 16, color: "#9a9aa3" }}>Verify</span>
              <span style={{ fontSize: 20, color: "#f5f5f6", marginTop: 8 }}>{verify}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 675 },
  );
}
