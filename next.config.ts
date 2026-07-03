import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the site is served as plain files by Caddy on the VM.
  output: "export",
  // No image-optimization server exists at runtime; tiers are pre-generated
  // by the seed pipeline.
  images: { unoptimized: true },
};

export default nextConfig;
