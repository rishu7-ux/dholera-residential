import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";

import {
  FaUserAlt,
  FaCalendarAlt,
  FaArrowRight,
} from "react-icons/fa";

import { getPayload } from "payload";
import config from "@/payload.config";

/* =========================================================
   TYPES
========================================================= */

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
  status?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  featuredImage?: Media | string | null;
};

/* =========================================================
   BLOG SECTION
========================================================= */

export default async function BlogSection() {
  await connection();

  const payload = await getPayload({
    config,
  });

  /* =========================================================
     GET PUBLISHED BLOGS
  ========================================================= */

  const result = await payload.find({
    collection: "blogs",

    where: {
      status: {
        equals: "published",
      },
    },

    sort: "-publishedAt",

    limit: 10,

    depth: 1,
  });

  const blogs = result.docs as Blog[];

  /* =========================================================
     DATE FORMAT
  ========================================================= */

  const formatDate = (date?: string | null) => {
    if (!date) return "";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  /*
   * Duplicate blogs for infinite continuous movement.
   */
  const runningBlogs =
    blogs.length > 0
      ? [...blogs, ...blogs]
      : [];

  return (
    <section className="overflow-hidden bg-[#F8FAFC] py-16 sm:py-20">

      {/* =====================================================
          CSS ANIMATION
      ===================================================== */}

      <style>
        {`
          @keyframes dholeraBlogScroll {
            0% {
              transform: translateX(0);
            }

            100% {
              transform: translateX(-50%);
            }
          }

          .dholera-blog-track {
            animation:
              dholeraBlogScroll
              35s
              linear
              infinite;

            will-change: transform;
          }

          .dholera-blog-slider:hover
          .dholera-blog-track {
            animation-play-state: paused;
          }

          @media (max-width: 768px) {
            .dholera-blog-track {
              animation-duration: 25s;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .dholera-blog-track {
              animation: none;
            }
          }
        `}
      </style>

      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">

        {/* =====================================================
            HEADING
        ===================================================== */}

        <div className="mb-10">

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7A00]">
            Latest Insights
          </p>

          <h2 className="mt-2 text-3xl font-light text-[#081A3A] sm:text-4xl lg:text-5xl">

            Our{" "}

            <span className="font-semibold text-[#FF7A00]">
              Blog
            </span>

          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-600 sm:text-base">

            Explore the latest Dholera property updates,
            infrastructure news, industrial development and
            investment opportunities.

          </p>

          <div className="mt-5 flex gap-1.5">

            {[1, 2, 3, 4, 5, 6].map((item) => (
              <span
                key={item}
                className="h-1.5 w-1.5 rounded-full bg-[#FF7A00]"
              />
            ))}

          </div>

        </div>

        {/* =====================================================
            CONTINUOUS BLOG SLIDER
        ===================================================== */}

        {blogs.length > 0 ? (

          <div className="dholera-blog-slider relative overflow-hidden py-5">

            {/* LEFT FADE */}

            <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-8 bg-linear-to-r from-[#F8FAFC] to-transparent sm:w-16" />

            {/* RIGHT FADE */}

            <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-linear-to-l from-[#F8FAFC] to-transparent sm:w-16" />

            {/* MOVING TRACK */}

            <div className="dholera-blog-track flex w-max gap-5">

              {runningBlogs.map((blog, index) => {

                /* ===========================================
                   IMAGE
                =========================================== */

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

                /* ===========================================
                   DATE
                =========================================== */

                const blogDate =
                  blog.publishedAt ||
                  blog.createdAt;

                /* ===========================================
                   BLOG URL
                =========================================== */

                const blogUrl =
                  `/blog/${blog.slug}`;

                return (

                  <article
                    key={`${blog.id}-${index}`}
                    className="
                      group
                      flex
                      w-68.75
                      shrink-0
                      flex-col
                      overflow-hidden
                      rounded-2xl
                      border
                      border-[#FFE1C7]
                      bg-white
                      shadow-[0_8px_25px_rgba(0,0,0,0.07)]
                      transition-all
                      duration-300

                      hover:-translate-y-2
                      hover:border-[#FF7A00]/50
                      hover:shadow-[0_18px_40px_rgba(255,122,0,0.15)]

                      sm:w-77.5
                      lg:w-82.5
                    "
                  >

                    {/* =======================================
                        IMAGE
                    ======================================= */}

                    <Link
                      href={blogUrl}
                      className="
                        relative
                        isolate
                        block
                        aspect-3/2
                        w-full
                        overflow-hidden
                        bg-[#FFF4EA]
                      "
                    >

                      <Image
                        src={imageUrl}
                        alt={imageAlt}
                        fill
                        sizes="
                          (max-width: 640px) 275px,
                          (max-width: 1024px) 310px,
                          330px
                        "
                        className="
                          object-cover
                          object-center
                          transition-transform
                          duration-700
                          sm:group-hover:scale-105
                        "
                      />

                      {/* OVERLAY */}

                      <div
                        className="
                          absolute
                          inset-0
                          z-10
                          bg-linear-to-t
                          from-[#081A3A]/55
                          via-transparent
                          to-transparent
                        "
                      />

                      {/* BADGE */}

                      <span
                        className="
                          absolute
                          left-4
                          top-4
                          z-20
                          rounded-full
                          bg-[#FF7A00]
                          px-3
                          py-1.5
                          text-[10px]
                          font-bold
                          uppercase
                          tracking-wider
                          text-white
                          shadow-md
                        "
                      >
                        Dholera
                      </span>

                    </Link>

                    {/* =======================================
                        CARD CONTENT
                    ======================================= */}

                    <div className="flex flex-1 flex-col p-5">

                      {/* META */}

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-500">

                        <span className="flex items-center gap-1.5">

                          <FaUserAlt className="text-[#FF7A00]" />

                          Admin

                        </span>

                        {blogDate && (

                          <span className="flex items-center gap-1.5">

                            <FaCalendarAlt className="text-[#FF7A00]" />

                            {formatDate(blogDate)}

                          </span>

                        )}

                      </div>

                      {/* TITLE */}

                      <Link href={blogUrl}>

                        <h3
                          className="
                            mt-4
                            line-clamp-2
                            text-lg
                            font-bold
                            leading-7
                            text-[#081A3A]
                            transition-colors
                            duration-300
                            group-hover:text-[#FF7A00]
                          "
                        >
                          {blog.title}
                        </h3>

                      </Link>

                      {/* DESCRIPTION */}

                      {blog.excerpt && (

                        <p
                          className="
                            mt-3
                            line-clamp-2
                            text-sm
                            leading-6
                            text-gray-500
                          "
                        >
                          {blog.excerpt}
                        </p>

                      )}

                      {/* READ MORE */}

                      <div className="mt-auto pt-5">

                        <Link
                          href={blogUrl}
                          className="
                            inline-flex
                            items-center
                            gap-2
                            text-sm
                            font-bold
                            text-[#FF7A00]
                            transition-all
                            duration-300
                            hover:gap-3
                          "
                        >

                          Read More

                          <FaArrowRight className="text-xs" />

                        </Link>

                      </div>

                    </div>

                  </article>

                );
              })}

            </div>

          </div>

        ) : (

          /* =================================================
             EMPTY STATE
          ================================================= */

          <div className="rounded-2xl border border-[#FFD9B8] bg-white p-10 text-center">

            <h3 className="text-xl font-semibold text-[#081A3A]">
              No Blogs Published Yet
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Publish a blog from Payload CMS and it will
              automatically appear here.
            </p>

          </div>

        )}

        {/* =====================================================
            VIEW ALL BLOGS
        ===================================================== */}

        {blogs.length > 0 && (

          <div className="mt-8 text-center">

            <Link
              href="/blog"
              className="
                inline-flex
                items-center
                gap-2
                rounded-xl
                bg-[#FF7A00]
                px-6
                py-3
                text-sm
                font-bold
                text-white
                shadow-[0_8px_20px_rgba(255,122,0,0.22)]
                transition-all
                duration-300

                hover:-translate-y-1
                hover:bg-[#FF8C24]
              "
            >

              View All Blogs

              <FaArrowRight />

            </Link>

          </div>

        )}

      </div>

    </section>
  );
}
