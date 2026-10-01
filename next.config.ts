import type { NextConfig } from "next";

const githubPages = process.env.GITHUB_PAGES === "true";
const nativeApp = process.env.NEXUS_NATIVE === "true";
const repositoryBasePath = "/nexus";

const staticExport = githubPages || nativeApp;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  ...(staticExport
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
        ...(githubPages
          ? {
              basePath: repositoryBasePath,
              assetPrefix: repositoryBasePath + "/",
            }
          : {}),
      }
    : {}),
};

export default nextConfig;
