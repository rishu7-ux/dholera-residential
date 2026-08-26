"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaArrowRight } from "react-icons/fa";

export default function Hero() {
  return (
    <section className="relative w-full overflow-hidden bg-transparent">
      {/* =====================================================
          IMAGE AREA
      ===================================================== */}

      <motion.div
        initial={{
          opacity: 0,
          scale: 1.02,
        }}
        animate={{
          opacity: 1,
          scale: 1,
        }}
        transition={{
          duration: 1.2,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="
          relative
          w-full

          sm:h-[calc(100vh-80px)]
          sm:min-h-155
        "
      >
        {/* =====================================================
            MOBILE IMAGE
        ===================================================== */}

        <div className="relative block w-full overflow-hidden sm:hidden">
          <motion.div
            animate={{
              scale: [1, 1.04, 1],
              x: [0, -4, 0],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="w-full"
          >
            <Image
              src="/images/kbvmc.jpg.jpeg"
              alt="Dholera Residential Plots"
              width={1920}
              height={1080}
              priority
              sizes="100vw"
              className="
                block
                h-auto
                w-full
              "
            />
          </motion.div>
        </div>

        {/* =====================================================
            DESKTOP ANIMATED IMAGE
        ===================================================== */}

        <motion.div
          className="
            absolute
            inset-0
            hidden

            sm:block
          "
          animate={{
            scale: [1.02, 1.08, 1.04, 1.02],
            x: [0, -10, 8, 0],
            y: [0, -5, 4, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Image
            src="/images/kbvmc.jpg.jpeg"
            alt="Dholera Residential Plots"
            fill
            priority
            sizes="100vw"
            className="
              object-cover
              object-center
            "
          />
        </motion.div>

        {/* =====================================================
            SOFT DARK OVERLAY
        ===================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            inset-0
            z-2
            bg-[#081A3A]/5
          "
        />

        {/* =====================================================
            MOVING ORANGE LIGHT EFFECT
        ===================================================== */}

        <motion.div
          className="
            pointer-events-none
            absolute
            -left-70
            -top-15
            z-3

            h-[130%]
            w-55

            rotate-15

            bg-linear-to-r
            from-transparent
            via-[#FF7A00]/18
            to-transparent

            blur-2xl
          "
          animate={{
            x: [0, 1900],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            repeatDelay: 3,
            ease: "easeInOut",
          }}
        />

        {/* =====================================================
            SOFT ORANGE GLOW
        ===================================================== */}

        <motion.div
          className="
            pointer-events-none
            absolute
            right-[8%]
            top-[15%]
            z-3

            h-55
            w-55

            rounded-full
            bg-[#FF7A00]/10
            blur-[80px]
          "
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.25, 0.5, 0.25],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* =====================================================
            BOTTOM GRADIENT
        ===================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            inset-x-0
            bottom-0
            z-10

            h-30

            bg-linear-to-t
            from-[#081A3A]/70
            via-[#081A3A]/15
            to-transparent

            sm:h-47.5
          "
        />

        {/* =====================================================
            BUTTONS ON IMAGE
        ===================================================== */}

        <div
          className="
            absolute
            inset-x-0
            bottom-3
            z-20

            sm:bottom-10
            md:bottom-12
            lg:bottom-14
          "
        >
          <motion.div
            initial={{
              opacity: 0,
              y: 25,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.7,
              delay: 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="
              mx-auto
              flex
              max-w-7xl
              items-center
              justify-center

              gap-2
              px-3

              sm:gap-4
              sm:px-6

              lg:px-8
            "
          >
            {/* =================================================
                EXPLORE BUTTON
            ================================================= */}

            <motion.div
              whileHover={{
                y: -3,
                scale: 1.02,
              }}
              whileTap={{
                scale: 0.97,
              }}
              className="
                min-w-0
                flex-1

                sm:flex-none
              "
            >
              <Link
                href="/properties"
                className="
                  group
                  relative

                  flex
                  w-full
                  items-center
                  justify-center
                  gap-2

                  overflow-hidden

                  rounded-full

                  bg-[#FF7A00]

                  px-3
                  py-2.5

                  text-[10px]
                  font-bold
                  text-white

                  shadow-[0_8px_25px_rgba(255,122,0,0.30)]

                  transition-all
                  duration-300

                  hover:bg-[#FF9638]
                  hover:shadow-[0_12px_30px_rgba(255,122,0,0.40)]

                  sm:w-auto
                  sm:gap-3
                  sm:px-8
                  sm:py-4
                  sm:text-base
                "
              >
                {/* SHINE EFFECT */}

                <span
                  className="
                    absolute
                    -left-full
                    top-0

                    h-full
                    w-[65%]

                    skew-x-[-20deg]

                    bg-linear-to-r
                    from-transparent
                    via-white/30
                    to-transparent

                    transition-all
                    duration-700

                    group-hover:left-[130%]
                  "
                />

                <span className="relative z-10 whitespace-nowrap">
                  Explore Projects
                </span>

                <FaArrowRight
                  className="
                    relative
                    z-10

                    text-[9px]

                    transition-transform
                    duration-300

                    group-hover:translate-x-1

                    sm:text-sm
                  "
                />
              </Link>
            </motion.div>

            {/* =================================================
                CONTACT BUTTON
            ================================================= */}

            <motion.div
              whileHover={{
                y: -3,
                scale: 1.02,
              }}
              whileTap={{
                scale: 0.97,
              }}
              className="
                min-w-0
                flex-1

                sm:flex-none
              "
            >
              <Link
                href="/contact-us"
                className="
                  group

                  flex
                  w-full
                  items-center
                  justify-center
                  gap-2

                  rounded-full

                  border
                  border-white/80

                  bg-[#081A3A]/25

                  px-3
                  py-2.5

                  text-[10px]
                  font-bold
                  text-white

                  backdrop-blur-sm

                  transition-all
                  duration-300

                  hover:border-[#FF7A00]
                  hover:bg-[#FF7A00]
                  hover:shadow-[0_10px_30px_rgba(255,122,0,0.30)]

                  sm:w-auto
                  sm:gap-3
                  sm:px-8
                  sm:py-4
                  sm:text-base
                "
              >
                <span className="whitespace-nowrap">
                  Contact Us
                </span>

                <FaArrowRight
                  className="
                    text-[9px]

                    transition-transform
                    duration-300

                    group-hover:translate-x-1

                    sm:text-sm
                  "
                />
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* =====================================================
            SMALL BOTTOM ORANGE LINE
        ===================================================== */}

        <motion.div
          initial={{
            scaleX: 0,
          }}
          animate={{
            scaleX: 1,
          }}
          transition={{
            duration: 1.2,
            delay: 0.4,
            ease: "easeOut",
          }}
          style={{
            transformOrigin: "left",
          }}
          className="
            absolute
            bottom-0
            left-0
            z-30

            h-[3px]
            w-full

            bg-[#FF7A00]

            shadow-[0_0_18px_rgba(255,122,0,0.55)]
          "
        />
      </motion.div>
    </section>
  );
}