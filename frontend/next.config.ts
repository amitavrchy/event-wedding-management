import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // Self-contained server bundle for the production Docker image (no effect on `next dev`).
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL || "http://localhost:4000"}/api/:path*`,
      },
    ];
  },
};
export default config;
