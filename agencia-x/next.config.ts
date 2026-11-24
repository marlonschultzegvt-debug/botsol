import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // As fontes das artes (carrossel) são lidas do disco no servidor: inclui no pacote da Vercel.
  outputFileTracingIncludes: {
    "/**": ["./src/assets/fonts/**"],
  },
  // sharp tem binário nativo: fica fora do bundle do servidor.
  serverExternalPackages: ["sharp"],
  // Logo da marca vai por server action (limite da Vercel é 4,5 MB).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
