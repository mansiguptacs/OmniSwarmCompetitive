import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  // Pin tracing root to this app (repo has multiple lockfiles).
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
