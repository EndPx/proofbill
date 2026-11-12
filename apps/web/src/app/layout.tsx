import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { WalletProvider } from "@/components/wallet";
import { DevTools } from "@/components/dev-tools";
export const metadata: Metadata = {
  metadataBase: new URL("https://proofbill-two.vercel.app"),
  title: {
    default: "ProofBill — Know what your agent bought",
    template: "%s · ProofBill",
  },
  description:
    "Fund a Purchase Pass, let your agent order a private AI service, inspect its evidence, and approve the exact payment.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
        {process.env.NODE_ENV === "development" && <DevTools />}
      </body>
    </html>
  );
}
