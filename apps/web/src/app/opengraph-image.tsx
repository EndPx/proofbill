import { ImageResponse } from "next/og";

export const alt = "ProofBill. Agents order. You approve.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: "#51e79c",
          color: "#171717",
          padding: "62px 70px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 36, fontWeight: 700 }}>ProofBill</span>
          <span style={{ fontSize: 20 }}>Built on NEAR testnet</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 78,
            lineHeight: 1.06,
            letterSpacing: "-4px",
          }}
        >
          <span>Agents order.</span>
          <span>You approve.</span>
        </div>
        <div style={{ display: "flex", fontSize: 25 }}>
          One Purchase Pass. A private result. Your approval to pay.
        </div>
      </div>
    ),
    size,
  );
}
