import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  FaArrowLeft,
  FaCalendarAlt,
  FaUserAlt,
} from "react-icons/fa";

import { getPayload } from "payload";
import config from "@/payload.config";

import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type Media = {
  id: string;
  url?: string | null;
  alt?: string | null;
};

type Blog = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  status?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  featuredImage?: Media | string | null;
};

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function BlogDetailPage({
  params,
}: PageProps) {
  const { slug } = await params;

  const payload = await getPayload({
    config,
  });

  const result = await payload.find({
    collection: "blogs",

    where: {
      and: [
        {
          slug: {
            equals: slug,
          },
        },
        {
          status: {
            equals: "published",
          },
        },
      ],
    },

    limit: 1,
    depth: 1,
  });

  if (!result.docs.length) {
    notFound();
  }

  const blog = result.docs[0] as Blog;

  const media =
    typeof blog.featuredImage === "object" &&
    blog.featuredImage !== null
      ? blog.featuredImage
      : null;

  const imageUrl =
    media?.url ||
    "/images/blog/blog1.jpg";

  const imageAlt =
    media?.alt ||
    blog.title;

  const blogDate =
    blog.publishedAt ||
    blog.createdAt;

  const formattedDate = blogDate
    ? new Date(blogDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <>
      <TopBar />
      <Header />

      <main className="min-h-screen bg-[#FFFDFB]">

        {/* DETAIL HERO */}

        <section className="border-b border-[#FFE2CC] bg-[#FFF7F0]">
          <div className="mx-auto max-w-5xl px-5 py-12 sm:px-6 lg:px-8 lg:py-16">

            <div className="flex flex-wrap items-center gap-2 text-sm text-[#8A7D73]">
              <Link
                href="/"
                className="hover:text-[#FF7A00]"
              >
                Home
              </Link>

              <span>/</span>

              <Link
                href="/blog"
                className="hover:text-[#FF7A00]"
              >
                Blog
              </Link>

              <span>/</span>

              <span className="text-[#FF7A00]">
                Article
              </span>
            </div>

            <span className="mt-7 inline-flex rounded-full bg-[#FFF0E4] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF7A00]">
              Dholera Insights
            </span>

            <h1 className="mt-5 max-w-4xl text-3xl font-black leading-tight text-[#1F2937] sm:text-4xl lg:text-5xl">
              {blog.title}
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-[#7B6D62]">

              <span className="flex items-center gap-2">
                <FaUserAlt className="text-[#FF7A00]" />
                Admin
              </span>

              {formattedDate && (
                <span className="flex items-center gap-2">
                  <FaCalendarAlt className="text-[#FF7A00]" />
                  {formattedDate}
                </span>
              )}

            </div>

          </div>
        </section>

        {/* ARTICLE */}

        <section className="py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8">

            <article className="overflow-hidden rounded-[26px] border border-[#F0E4DA] bg-white shadow-[0_16px_50px_rgba(35,24,18,0.07)]">

              {/* IMAGE */}

              <div className="relative aspect-video w-full overflow-hidden bg-[#FFF4EA]">
                <Image
                  src={imageUrl}
                  alt={imageAlt}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1000px"
                  className="object-cover"
                />
              </div>

              {/* CONTENT */}

              <div className="px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12">

                {blog.excerpt && (
                  <div className="mb-8 rounded-2xl border border-[#FFE0C5] bg-[#FFF8F2] px-5 py-5">
                    <p className="text-lg font-semibold leading-8 text-[#3D332C]">
                      {blog.excerpt}
                    </p>
                  </div>
                )}

                {blog.content ? (
                  <div className="whitespace-pre-line text-[16px] leading-8 text-[#5F554D]">
                    {blog.content}
                  </div>
                ) : (
                  <p className="text-[#79695D]">
                    Blog content is not available.
                  </p>
                )}

                <div className="my-10 h-px bg-[#F1E5DB]" />

                <Link
                  href="/blog"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#FF7A00] px-5 py-3 text-sm font-bold text-[#FF7A00] transition-all hover:bg-[#FF7A00] hover:text-white"
                >
                  <FaArrowLeft />
                  Back to Blogs
                </Link>

              </div>

            </article>

          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}