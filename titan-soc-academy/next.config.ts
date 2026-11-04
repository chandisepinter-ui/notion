import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The SQLite driver is a native module; keep it out of the bundler.
  serverExternalPackages: ["@libsql/client", "libsql"],
  poweredByHeader: false,
  // Enables forbidden() for permission-denied pages.
  experimental: { authInterrupts: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
