import type { NextConfig } from "next";

const githubPages = process.env.GITHUB_PAGES === "true";
const repositoryBasePath = "/nexus";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  ...(githubPages
    ? {
        output: "export",
        basePath: repositoryBasePath,
        assetPrefix: repositoryBasePath + "/",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
