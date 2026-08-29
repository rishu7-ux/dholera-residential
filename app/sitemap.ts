import type { MetadataRoute } from "next";
import { getPayload } from "payload";

import config from "@/payload.config";

const SITE_URL = "https://dholeraresidentialplot.com";

type SitemapBlog = {
  slug: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "blogs",
    where: {
      status: {
        equals: "published",
      },
    },
    limit: 1000,
    sort: "-publishedAt",
  });

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/properties`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/about-us`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact-us`, changeFrequency: "monthly", priority: 0.7 },
    {
      url: `${SITE_URL}/properties/ridhi-249-2`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/properties/ridhi-966-1`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/properties/sidhi-857`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const blogPages: MetadataRoute.Sitemap = (result.docs as SitemapBlog[]).map(
    (blog) => ({
      url: `${SITE_URL}/blog/${blog.slug}`,
      lastModified: blog.updatedAt ?? blog.publishedAt ?? undefined,
      changeFrequency: "monthly",
      priority: 0.7,
    }),
  );

  return [...staticPages, ...blogPages];
}
