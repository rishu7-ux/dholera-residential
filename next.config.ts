import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  /* keep your Next.js config here */
};

export default withPayload(nextConfig);