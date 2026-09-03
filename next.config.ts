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
      {
        source: "/ingestion/granot/lifecycle/health/:path*",
        destination: "/granot-lifecycle/health",
        permanent: true,
      },
      {
        source: "/ingestion/granot/lifecycle/health",
        destination: "/granot-lifecycle/health",
        permanent: true,
      },
      {
        source: "/ingestion/granot/lifecycle/jobs/:jobNo",
        destination: "/job-timeline?job=:jobNo",
        permanent: true,
      },
      {
        source: "/ingestion/granot/lifecycle",
        destination: "/intakes",
        permanent: true,
      },
      {
        source: "/settings",
        destination: "/operations-registry?tab=moving-carriers",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
