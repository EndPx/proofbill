import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { DevTools } from "@/components/dev-tools";
export const metadata: Metadata = {
  metadataBase: new URL("https://proofbill-two.vercel.app"),
  title: {
    default: "ProofBill — Know what your agent bought",
    template: "%s · ProofBill",
  },
  description:
    "Fund a Purchase Pass, choose your agent and payment policy, and trace the private service purchase to its onchain receipt.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.NODE_ENV === "development" && <DevTools />}
      </body>
    </html>
  );
}
