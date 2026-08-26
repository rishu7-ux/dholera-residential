import { getPayload } from "payload";
import config from "../../../payload.config";

type Media = { url?: string | null; alt?: string | null };

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  try {
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: "dholera-estates-blogs",
      where: slug ? { and: [{ slug: { equals: slug } }, { status: { equals: "published" } }] } : { status: { equals: "published" } },
      sort: "-publishedAt", limit: slug ? 1 : 100, depth: 1,
    });
    const blogs = result.docs.map((blog) => {
      const media = typeof blog.featuredImage === "object" && blog.featuredImage !== null ? blog.featuredImage as Media : null;
      return { id: blog.id, title: blog.title, slug: blog.slug, excerpt: blog.excerpt,
        content: blog.content, publishedAt: blog.publishedAt || blog.createdAt,
        imageUrl: media?.url || null, imageAlt: media?.alt || blog.title };
    });
    return Response.json({ success: true, blogs }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("Dholera Estates blogs could not be loaded", error);
    return Response.json({ success: false, message: "Blogs are temporarily unavailable" }, { status: 500 });
  }
}
