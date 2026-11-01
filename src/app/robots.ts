import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

const PUBLIC_RULE = {
  allow: "/",
  disallow: ["/admin", "/api", "/atalho", "/atalho/"] as string[],
};

const AI_USER_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
] as const;

const META_USER_AGENTS = [
  "facebookexternalhit",
  "Facebot",
  "meta-externalagent",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        ...PUBLIC_RULE,
      },
      ...META_USER_AGENTS.map((userAgent) => ({
        userAgent,
        ...PUBLIC_RULE,
        allow: ["/", "/api/meta/catalog.csv$", "/api/catalog-jpg/"],
      })),
      ...AI_USER_AGENTS.map((userAgent) => ({
        userAgent,
        ...PUBLIC_RULE,
      })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
