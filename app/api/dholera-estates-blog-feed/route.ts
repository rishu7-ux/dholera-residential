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
      const record = blog as unknown as {
        id: string | number;
        slug: string;
        blogTitle?: string | null;
        shortDescription?: string | null;
        blogContent?: string | null;
        title?: string | null;
        excerpt?: string | null;
        content?: string | null;
        publishedAt?: string | null;
        createdAt: string;
      };
      const media = typeof blog.featuredImage === "object" && blog.featuredImage !== null ? blog.featuredImage as Media : null;
      const title = record.blogTitle || record.title;
      return { id: record.id, title, slug: record.slug,
        excerpt: record.shortDescription || record.excerpt,
        content: record.blogContent || record.content,
        publishedAt: record.publishedAt || record.createdAt,
        imageUrl: media?.url || null, imageAlt: media?.alt || title };
    });
    return Response.json({ success: true, blogs }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("Dholera Estates blogs could not be loaded", error);
    return Response.json({ success: false, message: "Blogs are temporarily unavailable" }, { status: 500 });
  }
}
