import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const socket = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
const socketWs = socket.replace(/^http/, "ws");
// Direct browser uploads go to object storage (S3/R2/MinIO) and CDN images load from it.
const uploadOrigin = process.env.NEXT_PUBLIC_UPLOAD_ORIGIN || "";

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; a nonce-based policy would make every page dynamic.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${socket} ${socketWs} ${uploadOrigin}`.trim(),
  "media-src 'self' blob: https:",
  "frame-src https://www.youtube.com https://www.facebook.com https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${uploadOrigin}`.trim(),
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Camera for QR check-in and photo uploads; nothing else.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const config: NextConfig = {
  poweredByHeader: false,
  // Self-contained server bundle for the production Docker image (no effect on `next dev`).
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
