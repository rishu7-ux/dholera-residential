import Image from "next/image";
import Link from "next/link";

import {
  FaArrowRight,
  FaCalendarAlt,
  FaUserAlt,
} from "react-icons/fa";

import { getPayload } from "payload";
import config from "@/payload.config";

import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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
   BLOG PAGE
========================================================= */

export default async function BlogPage() {
  /* =======================================================
     PAYLOAD CMS
  ======================================================= */

  const payload = await getPayload({
    config,
  });

  /* =======================================================
     GET PUBLISHED BLOGS
  ======================================================= */

  const result = await payload.find({
    collection: "blogs",

    where: {
      status: {
        equals: "published",
      },
    },

    sort: "-publishedAt",
    limit: 100,
    depth: 1,
  });

  const blogs = result.docs as Blog[];

  /* =======================================================
     FORMAT DATE
  ======================================================= */

  const formatDate = (date?: string | null) => {
    if (!date) return "";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <>
      {/* =====================================================
          TOP BAR
      ===================================================== */}

      <TopBar />

      {/* =====================================================
          HEADER
      ===================================================== */}

      <Header />

      <main className="min-h-screen bg-[#FFFDFB]">
        {/* =====================================================
            ORANGE GEOMETRIC HERO
        ===================================================== */}

        <section
          className="
            relative
            overflow-hidden
            bg-[#FF7A00]
          "
        >
          {/* ===================================================
              LEFT LARGE DIAGONAL SHAPE
          =================================================== */}

          <div
            className="
              pointer-events-none
              absolute

              -left-30
              -top-40

              h-125
              w-77.5

              rotate-32

              bg-white/10
            "
          />

          {/* ===================================================
              CENTER LARGE DIAGONAL SHAPE
          =================================================== */}

          <div
            className="
              pointer-events-none
              absolute

              left-[28%]
              -top-52.5

              h-155
              w-75

              rotate-38

              bg-[#FFB067]/20
            "
          />

          {/* ===================================================
              CENTER SECOND SHAPE
          =================================================== */}

          <div
            className="
              pointer-events-none
              absolute

              left-[44%]
              -top-47.5

              h-140
              w-62.5

              rotate-[-38deg]

              bg-white/8
            "
          />

          {/* ===================================================
              RIGHT LARGE ANGLED SHAPE
          =================================================== */}

          <div
            className="
              pointer-events-none
              absolute

              right-[8%]
              -top-47.5

              h-140
              w-72.5

              rotate-12

              bg-[#FFB067]/25
            "
          />

          {/* ===================================================
              RIGHT INNER SHAPE
          =================================================== */}

          <div
            className="
              pointer-events-none
              absolute

              right-[18%]
              -top-25

              h-82.5
              w-60

              rotate-45

              bg-white/7
            "
          />

          {/* ===================================================
              BOTTOM RIGHT SHAPE
          =================================================== */}

          <div
            className="
              pointer-events-none
              absolute

              -bottom-45
              -right-20

              h-85
              w-130

              rotate-12

              bg-[#FF9A45]/25
            "
          />

          {/* ===================================================
              SOFT LIGHT EFFECT
          =================================================== */}

          <div
            className="
              pointer-events-none
              absolute

              right-[30%]
              top-[10%]

              h-56
              w-56

              rounded-full

              bg-white/5

              blur-3xl
            "
          />

          {/* ===================================================
              HERO CONTENT
          =================================================== */}

          <div
            className="
              relative
              z-10

              mx-auto
              max-w-7xl

              px-5
              py-8

              sm:px-6
              sm:py-10

              lg:px-8
              lg:py-12
            "
          >
            <div className="max-w-5xl">
              {/* SMALL LABEL */}

              <p
                className="
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.24em]

                  text-white/90

                  sm:text-xs
                "
              >
                Dholera Insights
              </p>

              {/* MAIN HEADING */}

              <h1
                className="
                  mt-3

                  max-w-5xl

                  text-[30px]
                  font-black
                  leading-[1.12]

                  text-white

                  sm:text-4xl
                  md:text-5xl
                  lg:text-[54px]
                "
              >
                Explore Our Latest{" "}
                <span className="text-[#081A3A]">
                  Blogs &amp; Updates
                </span>
              </h1>

              {/* DESCRIPTION */}

              <p
                className="
                  mt-4

                  max-w-3xl

                  text-[14px]
                  leading-7

                  text-white/90

                  sm:text-[15px]
                  sm:leading-7

                  md:text-base
                "
              >
                Read the latest Dholera property news, investment
                insights, infrastructure updates and development
                stories.
              </p>

              {/* =================================================
                  BREADCRUMB
              ================================================= */}

              <div
                className="
                  mt-5

                  flex
                  items-center
                  gap-2

                  text-[12px]

                  text-white/80

                  sm:text-sm
                "
              >
                <Link
                  href="/"
                  className="
                    transition-colors
                    duration-300

                    hover:text-[#081A3A]
                  "
                >
                  Home
                </Link>

                <span className="text-white/60">
                  /
                </span>

                <span
                  className="
                    font-semibold
                    text-[#081A3A]
                  "
                >
                  Blog
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            BLOG SECTION
        ===================================================== */}

        <section
          className="
            py-11
            sm:py-16
            lg:py-20
          "
        >
          <div
            className="
              mx-auto
              max-w-7xl

              px-3

              sm:px-6
              lg:px-8
            "
          >
            {/* =================================================
                BLOG SECTION HEADING
            ================================================= */}

            <div
              className="
                mb-7

                flex
                flex-col
                gap-3

                sm:mb-9
                sm:gap-4

                lg:mb-10
                lg:flex-row
                lg:items-end
                lg:justify-between
              "
            >
              <div>
                {/* SMALL TITLE */}

                <p
                  className="
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-[0.2em]

                    text-[#FF7A00]

                    sm:text-xs
                  "
                >
                  Latest Articles
                </p>

                {/* SECTION HEADING */}

                <h2
                  className="
                    mt-2

                    text-[27px]
                    font-black
                    leading-tight

                    text-[#1F2937]

                    sm:text-3xl
                    lg:text-4xl
                  "
                >
                  Fresh Insights From{" "}
                  <span className="text-[#FF7A00]">
                    Dholera
                  </span>
                </h2>
              </div>

              {/* DESCRIPTION */}

              <p
                className="
                  max-w-xl

                  text-[12px]
                  leading-6

                  text-[#6B7280]

                  sm:text-sm
                  sm:leading-7
                "
              >
                Browse our latest published articles directly from
                Payload CMS.
              </p>
            </div>

            {/* =================================================
                BLOG CARDS
            ================================================= */}

            {blogs.length > 0 ? (
              <div
                className="
                  grid
                  grid-cols-1
                  gap-5

                  sm:grid-cols-2
                  sm:gap-6

                  lg:grid-cols-3
                "
              >
                {blogs.map((blog) => {
                  /* =============================================
                     FEATURED IMAGE
                  ============================================= */

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

                  /* =============================================
                     BLOG DATE
                  ============================================= */

                  const blogDate =
                    blog.publishedAt ||
                    blog.createdAt;

                  /* =============================================
                     BLOG URL
                  ============================================= */

                  const blogUrl = `/blog/${blog.slug}`;

                  return (
                    <article
                      key={blog.id}
                      className="
                        group

                        mx-auto

                        flex
                        h-full

                        w-[97%]
                        max-w-100

                        flex-col

                        overflow-hidden

                        rounded-[20px]

                        border
                        border-[#F0E4DA]

                        bg-white

                        shadow-[0_8px_24px_rgba(35,24,18,0.06)]

                        transition-all
                        duration-300

                        hover:-translate-y-1
                        hover:border-[#FF7A00]/30
                        hover:shadow-[0_16px_38px_rgba(255,122,0,0.11)]

                        sm:w-full
                        sm:max-w-none
                        sm:rounded-[21px]

                        lg:rounded-[22px]
                        lg:hover:-translate-y-1.5
                      "
                    >
                      {/* =========================================
                          BLOG IMAGE
                      ========================================= */}

                      <Link
                        href={blogUrl}
                        className="
                          relative
                          block

                          h-43.75
                          w-full

                          overflow-hidden

                          bg-[#FFF4EA]

                          sm:h-48
                          md:h-50
                          lg:h-55
                        "
                      >
                        <Image
                          src={imageUrl}
                          alt={imageAlt}
                          fill
                          sizes="
                            (max-width: 640px) 400px,
                            (max-width: 1024px) 50vw,
                            33vw
                          "
                          className="
                            object-cover

                            transition-transform
                            duration-500

                            group-hover:scale-105
                          "
                        />

                        {/* IMAGE OVERLAY */}

                        <div
                          className="
                            absolute
                            inset-0

                            bg-linear-to-t
                            from-black/35
                            via-transparent
                            to-transparent
                          "
                        />

                        {/* DHOLERA BADGE */}

                        <span
                          className="
                            absolute

                            left-3
                            top-3

                            rounded-full

                            bg-white/95

                            px-2.5
                            py-1

                            text-[9px]
                            font-bold
                            uppercase
                            tracking-[0.08em]

                            text-[#FF7A00]

                            shadow-sm

                            sm:left-4
                            sm:top-4
                            sm:px-3
                            sm:py-1.5
                            sm:text-[10px]
                          "
                        >
                          Dholera
                        </span>
                      </Link>

                      {/* =========================================
                          BLOG CONTENT
                      ========================================= */}

                      <div
                        className="
                          flex
                          flex-1
                          flex-col

                          p-4

                          sm:p-5
                        "
                      >
                        {/* AUTHOR + DATE */}

                        <div
                          className="
                            flex
                            flex-wrap
                            items-center

                            gap-x-3
                            gap-y-1

                            text-[10px]
                            text-[#8A7D73]

                            sm:gap-4
                            sm:text-[11px]
                          "
                        >
                          <span
                            className="
                              flex
                              items-center
                              gap-1.5
                            "
                          >
                            <FaUserAlt
                              className="
                                text-[9px]
                                text-[#FF7A00]

                                sm:text-[10px]
                              "
                            />

                            Admin
                          </span>

                          {blogDate && (
                            <span
                              className="
                                flex
                                items-center
                                gap-1.5
                              "
                            >
                              <FaCalendarAlt
                                className="
                                  text-[9px]
                                  text-[#FF7A00]

                                  sm:text-[10px]
                                "
                              />

                              {formatDate(blogDate)}
                            </span>
                          )}
                        </div>

                        {/* BLOG TITLE */}

                        <Link href={blogUrl}>
                          <h3
                            className="
                              mt-3

                              line-clamp-2

                              text-[17px]
                              font-bold
                              leading-6

                              text-[#1F2937]

                              transition-colors
                              duration-300

                              group-hover:text-[#FF7A00]

                              sm:mt-4
                              sm:text-[19px]
                              sm:leading-7

                              lg:text-xl
                            "
                          >
                            {blog.title}
                          </h3>
                        </Link>

                        {/* BLOG EXCERPT */}

                        {blog.excerpt && (
                          <p
                            className="
                              mt-2

                              line-clamp-2

                              text-[12px]
                              leading-5

                              text-[#6B7280]

                              sm:mt-3
                              sm:line-clamp-3
                              sm:text-sm
                              sm:leading-6
                            "
                          >
                            {blog.excerpt}
                          </p>
                        )}

                        {/* READ MORE */}

                        <div
                          className="
                            mt-auto
                            pt-4

                            sm:pt-5
                          "
                        >
                          <Link
                            href={blogUrl}
                            className="
                              inline-flex
                              items-center

                              gap-1.5

                              text-[12px]
                              font-bold

                              text-[#FF7A00]

                              transition-all
                              duration-300

                              hover:gap-2.5

                              sm:gap-2
                              sm:text-sm

                              sm:hover:gap-3
                            "
                          >
                            Read More

                            <FaArrowRight
                              className="
                                text-[9px]
                                sm:text-xs
                              "
                            />
                          </Link>
                        </div>
                      </div>

                      {/* ORANGE BOTTOM HOVER LINE */}

                      <div
                        className="
                          h-0.75
                          w-0

                          bg-[#FF7A00]

                          transition-all
                          duration-500

                          group-hover:w-full
                        "
                      />
                    </article>
                  );
                })}
              </div>
            ) : (
              /* =================================================
                  NO BLOGS
              ================================================= */

              <div
                className="
                  mx-auto

                  w-[97%]
                  max-w-100

                  rounded-[20px]

                  border
                  border-[#FFD9B8]

                  bg-white

                  px-5
                  py-10

                  text-center

                  sm:w-full
                  sm:max-w-none
                  sm:rounded-[22px]
                  sm:px-6
                  sm:py-16
                "
              >
                <h3
                  className="
                    text-[18px]
                    font-bold
                    text-[#1F2937]

                    sm:text-xl
                  "
                >
                  No Blogs Published Yet
                </h3>

                <p
                  className="
                    mt-2

                    text-[12px]
                    text-[#6B7280]

                    sm:text-sm
                  "
                >
                  Publish a blog in Payload CMS and it will appear here.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <Footer />
    </>
  );
}