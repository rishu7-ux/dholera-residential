import { getPayload } from "payload";
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html";
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";

import config from "../../../payload.config";

type Media = {
  url?: string | null;
  alt?: string | null;
};

function toRichContentHtml(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  try {
    const html = convertLexicalToHTML({
      data: value as SerializedEditorState,
    });
    if (!html) return null;

    // An untouched editor still serialises to an empty wrapper element.
    // Treat markup with no visible content as absent so the Estate 2
    // frontend falls back to the existing plain-text `content` field.
    const hasVisibleContent =
      html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0 ||
      /<(img|hr|iframe|video)\b/i.test(html);

    return hasVisibleContent ? html : null;
  } catch (error) {
    console.error("Estate 2 rich content could not be serialised", error);
    return null;
  }
}

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
      collection: "estate2-blogs",
      where: slug
        ? {
            and: [
              { slug: { equals: slug } },
              { status: { equals: "published" } },
            ],
          }
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
        richContentHtml: toRichContentHtml(
          (blog as { richContent?: unknown }).richContent,
        ),
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
    console.error("Estate 2 blogs could not be loaded", error);
    return Response.json(
      { success: false, message: "Blogs are temporarily unavailable" },
      { status: 500 },
    );
  }
}
