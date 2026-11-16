import type { NextConfig } from "next";

const config: NextConfig = {
  ...(process.env.AIDECK_DIST_DIR ? { distDir: process.env.AIDECK_DIST_DIR } : {}),
};
export default config;
