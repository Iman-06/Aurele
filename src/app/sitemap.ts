import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { listProducts } from "@/server/catalog/catalog";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.aurele.pk";
}

const PAGES = ["", "/new-arrivals", "/one-of-a-kind", "/store", "/earrings", "/rings", "/necklaces", "/bracelets", "/search", "/terms", "/returns", "/privacy", "/shipping"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl();
  const catalog = await listProducts(db, { pageSize: 48 }).catch(() => null);
  const now = new Date();
  return [
    ...PAGES.map((path) => ({
      url: `${site}${path || "/"}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...(catalog?.items ?? []).map((product) => ({
      url: `${site}/products/${product.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
