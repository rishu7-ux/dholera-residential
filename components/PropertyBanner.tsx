"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface PropertyBannerProps {
  title: string;
}

export default function PropertyBanner({
  title,
  
}: PropertyBannerProps) {
  return (
    <section className="relative overflow-hidden bg-[#FF7A00]">
      {/* =====================================================
          BACKGROUND DECORATION
      ===================================================== */}

      <div className="pointer-events-none absolute inset-0">
        {/* LARGE RIGHT SHAPE */}

        <motion.div
          initial={{
            opacity: 0,
            x: 120,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            duration: 0.9,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            absolute
            right-[-8%]
            top-[-45%]
            h-80
            w-[320px]
            rotate-12
            border-45
            border-white/10

            sm:h-95
            sm:w-95

            lg:right-[-2%]
            lg:top-[-80%]
            lg:h-115
            lg:w-115
            lg:border-60
          "
        />

        {/* SECOND SUBTLE SHAPE */}

        <motion.div
          initial={{
            opacity: 0,
            x: 70,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            duration: 1,
            delay: 0.1,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            absolute
            right-[12%]
            top-[5%]
            hidden
            h-36
            w-36
            rotate-45
            border-20
            border-white/5

            md:block
          "
        />

        {/* SOFT LIGHT EFFECT */}

        <div
          className="
            absolute
            -left-20
            -bottom-20
            h-52
            w-52
            rounded-full
            bg-white/10
            blur-3xl
          "
        />
      </div>

      {/* =====================================================
          CONTENT
      ===================================================== */}

      <div
        className="
          relative
          mx-auto
          flex
          min-h-47.5
          max-w-7xl
          items-center
          px-5
          py-8

          sm:min-h-51.25
          sm:px-6

          md:min-h-53.75

          lg:min-h-55
          lg:px-8
        "
      >
        <motion.div
          initial={{
            opacity: 0,
            y: 30,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="max-w-4xl"
        >
          {/* =================================================
              SMALL LABEL
          ================================================= */}

          <motion.div
            initial={{
              opacity: 0,
              x: -20,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            transition={{
              duration: 0.55,
              delay: 0.15,
            }}
            className="mb-4 flex items-center gap-3"
          >
            <span className="h-0.5 w-9 rounded-full bg-white" />

            <span
              className="
                text-[10px]
                font-extrabold
                uppercase
                tracking-[0.22em]
                text-white/90

                sm:text-xs
              "
            >
              Dholera Residential Plot
            </span>
          </motion.div>

          {/* =================================================
              TITLE
          ================================================= */}

          <motion.h1
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.65,
              delay: 0.1,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="
              text-3xl
              font-extrabold
              leading-tight
              tracking-tight
              text-white

              sm:text-4xl
              md:text-[42px]
              lg:text-[46px]
            "
          >
            {title}
          </motion.h1>

          {/* =================================================
              BREADCRUMB
          ================================================= */}

          <motion.div
            initial={{
              opacity: 0,
              y: 15,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.5,
              delay: 0.3,
            }}
            className="
              mt-5
              flex
              flex-wrap
              items-center
              gap-2
              text-sm
              font-medium
              text-white/90

              sm:text-[15px]
            "
          >
            {/* HOME */}

            <Link
              href="/"
              className="
                relative
                transition-all
                duration-300

                hover:text-[#081A3A]
              "
            >
              Home
            </Link>

            {/* SEPARATOR */}

            <motion.span
              initial={{
                opacity: 0,
                scale: 0.5,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              transition={{
                delay: 0.4,
                duration: 0.3,
              }}
              className="
                flex
                h-5
                w-5
                items-center
                justify-center
                rounded-full
                bg-white/15
                text-[9px]
                text-white
              "
            >
              /
            </motion.span>

            {/* CURRENT PAGE */}

            <span className="font-semibold text-white">
              {title}
            </span>
          </motion.div>
        </motion.div>
      </div>

      {/* =====================================================
          BOTTOM BORDER
      ===================================================== */}

      <motion.div
        initial={{
          scaleX: 0,
        }}
        animate={{
          scaleX: 1,
        }}
        transition={{
          duration: 1,
          delay: 0.25,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="
          absolute
          bottom-0
          left-0
          h-px
          w-full
          origin-left
          bg-linear-to-r
          from-transparent
          via-white/35
          to-transparent
        "
      />
    </section>
  );
}