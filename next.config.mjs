import { BASE_PATH } from "./src/lib/putanje.js";

const nextConfig = {
  basePath: BASE_PATH,
  poweredByHeader: false,
  reactStrictMode: true,
  agentRules: false,
  // `pnpm dev` is opened as localhost (edge on :8000) or 127.0.0.1:3120.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
