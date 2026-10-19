import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

// The test installs packages one folder up (tests/), so point Turbopack's root there.
const nextConfig: NextConfig = { turbopack: { root: fileURLToPath(new URL("..", import.meta.url)) } };
export default nextConfig;
