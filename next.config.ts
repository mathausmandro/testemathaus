import type { NextConfig } from "next";
import { cabecalhosDeSeguranca } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  // Cabeçalhos fixos de segurança; a CSP com nonce é aplicada por requisição em src/proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: cabecalhosDeSeguranca(),
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
