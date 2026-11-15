import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  outputFileTracingRoot: projectRoot,
  async redirects() {
    return [
      {
        source: "/ridhi-966-1-sco-plots.php",
        destination: "/properties/ridhi-966-1",
        permanent: true,
      },
      {
        source: "/ridhi-249-2-premium-sco-plots.php",
        destination: "/properties/ridhi-249-2",
        permanent: true,
      },
      {
        source: "/sidhi857.php",
        destination: "/properties/sidhi-857",
        permanent: true,
      },
      {
        source: "/properties.php",
        destination: "/properties",
        permanent: true,
      },
      {
        source: "/index.php",
        destination: "/",
        permanent: true,
      },
      {
        source: "/dholera-residential-plot.php",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default withPayload(nextConfig);
