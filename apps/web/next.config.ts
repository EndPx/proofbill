import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@proofbill/shared", "@proofbill/server"],
  async headers() {
    return ["/app/:path*", "/api/:path*"].map(source => ({
      source,
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      ],
    }));
  },
};

export default nextConfig;
