import { getPayload } from "payload";

import config from "../../../payload.config";

type Media = { url?: string | null; alt?: string | null };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim();
  const requestedLimit = Number(searchParams.get("limit") || 100);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
    : 100;

  try {
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: "industrial-blogs",
      where: slug
        ? { and: [{ slug: { equals: slug } }, { status: { equals: "published" } }] }
        : { status: { equals: "published" } },
      sort: "-publishedAt",
      limit: slug ? 1 : limit,
      depth: 1,
    });

    const blogs = result.docs.map((blog) => {
      const media =
        typeof blog.featuredImage === "object" && blog.featuredImage !== null
          ? (blog.featuredImage as Media)
          : null;

      return {
        id: blog.id,
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        content: blog.content,
        publishedAt: blog.publishedAt || blog.createdAt,
        imageUrl: media?.url || null,
        imageAlt: media?.alt || blog.title,
      };
    });

    return Response.json(
      { success: true, blogs },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("Industrial blogs could not be loaded", error);
    return Response.json(
      { success: false, blogs: [], message: "Blogs are temporarily unavailable" },
      { status: 500 },
    );
  }
}
