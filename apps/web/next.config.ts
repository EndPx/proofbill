import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@proofbill/shared", "@proofbill/server"],
};

export default nextConfig;
