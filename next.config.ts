import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/ingestion/granot/live",
        destination: "/live-events",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
