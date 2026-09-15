import { getPayload } from "payload";
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html";
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";

import config from "../../../payload.config";

type Media = { url?: string | null; alt?: string | null };

function toRichContentHtml(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  try {
    const html = convertLexicalToHTML({
      data: value as SerializedEditorState,
    });
    if (!html) return null;

    // An untouched editor still serialises to an empty wrapper element.
    // Treat markup with no visible content as absent so the Dholera Estates
    // frontend falls back to the existing plain-text `content` field.
    const hasVisibleContent =
      html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0 ||
      /<(img|hr|iframe|video)\b/i.test(html);

    return hasVisibleContent ? html : null;
  } catch (error) {
    console.error("Dholera Estates rich content could not be serialised", error);
    return null;
  }
}

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
        richContent?: unknown;
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
        richContentHtml: toRichContentHtml(record.richContent),
        publishedAt: record.publishedAt || record.createdAt,
        imageUrl: media?.url || null, imageAlt: media?.alt || title };
    });
    return Response.json({ success: true, blogs }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("Dholera Estates blogs could not be loaded", error);
    return Response.json({ success: false, message: "Blogs are temporarily unavailable" }, { status: 500 });
  }
}
