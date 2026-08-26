"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { HiMenuAlt3, HiX } from "react-icons/hi";
import { FaPhoneAlt } from "react-icons/fa";

/* =========================================================
   COLOR THEME

   DARK NAVY    : #061A33
   DEEP ORANGE  : #F36B00
   ORANGE       : #FF8500
   MID ORANGE   : #FFA31A
   LIGHT ORANGE : #FFC04D
   SOFT ORANGE  : #FFF5E6
========================================================= */

/* =========================================================
   NAVIGATION LINKS
========================================================= */

const navLinks = [
  {
    label: "HOME",
    href: "/",
  },
  {
    label: "PROPERTIES",
    href: "/properties",
  },
  {
    label: "ABOUT US",
    href: "/about-us",
  },
  {
    label: "BLOG",
    href: "/blog",
  },
  {
    label: "CONTACT US",
    href: "/contact-us",
  },
];

/* =========================================================
   HEADER
========================================================= */

export default function Header() {
  const [open, setOpen] = useState(false);

  const pathname = usePathname();

  /* =========================================================
     CHECK ACTIVE PAGE
  ========================================================= */

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <motion.header
      initial={{
        y: -60,
        opacity: 0,
      }}
      animate={{
        y: 0,
        opacity: 1,
      }}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="
        sticky
        top-0
        z-50

        border-b
        border-gray-100

        bg-white/95

        shadow-[0_8px_30px_rgba(0,0,0,0.06)]

        backdrop-blur-xl
      "
    >
      {/* =====================================================
          MAIN HEADER
      ===================================================== */}

      <div
        className="
          mx-auto
          flex
          h-21.5
          max-w-7xl
          items-center
          justify-between

          px-4
          sm:px-5
          md:px-6

          lg:h-23
        "
      >
        {/* =================================================
            LOGO
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
            duration: 0.6,
            delay: 0.1,
          }}
          whileHover={{
            scale: 1.03,
          }}
          className="shrink-0"
        >
          <Link
            href="/"
            className="
              flex
              items-center
              justify-start
            "
          >
            <div
              className="
                relative

                h-16
                w-36.25

                sm:h-17
                sm:w-41.25

                md:h-18
                md:w-46.25

                lg:h-19
                lg:w-51.25
              "
            >
              <Image
                src="/images/logo2.JPG.jpeg"
                alt="Dholera Logo"
                fill
                priority
                sizes="
                  (max-width: 640px) 145px,
                  (max-width: 768px) 165px,
                  (max-width: 1024px) 185px,
                  205px
                "
                className="
                  object-contain
                  object-left
                "
              />
            </div>
          </Link>
        </motion.div>

        {/* =================================================
            DESKTOP RIGHT SIDE
        ================================================= */}

        <div className="hidden items-center lg:ml-auto lg:flex">
          {/* =================================================
              DESKTOP NAVIGATION
          ================================================= */}

          <nav className="flex items-center gap-5 xl:gap-7">
            {navLinks.map((link, index) => {
              const active = isActive(link.href);

              return (
                <motion.div
                  key={link.label}
                  initial={{
                    opacity: 0,
                    y: -12,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: 0.15 + index * 0.07,
                    duration: 0.4,
                  }}
                >
                  <Link
                    href={link.href}
                    className={`
                      group/nav
                      relative
                      inline-flex
                      items-center

                      py-2

                      text-[13px]
                      font-semibold
                      tracking-wider

                      transition-all
                      duration-300

                      hover:-translate-y-0.5

                      xl:text-[14px]

                      ${
                        active
                          ? "text-[#FF8500]"
                          : "text-[#303030] hover:text-[#FF8500]"
                      }
                    `}
                  >
                    {link.label}

                    {/* =========================================
                        ACTIVE / HOVER UNDERLINE
                    ========================================= */}

                    <span
                      className={`
                        absolute
                        -bottom-1
                        left-1/2

                        h-0.75

                        -translate-x-1/2

                        rounded-full

                        bg-linear-to-r
                        from-[#F36B00]
                        via-[#FF8500]
                        to-[#FFC04D]

                        transition-all
                        duration-300

                        ${
                          active
                            ? "w-full"
                            : "w-0 group-hover/nav:w-full"
                        }
                      `}
                    />
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          {/* =================================================
              DESKTOP PHONE BUTTON
          ================================================= */}

          <motion.div
            initial={{
              opacity: 0,
              x: 20,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            transition={{
              delay: 0.45,
              duration: 0.5,
            }}
            whileHover={{
              y: -2,
              scale: 1.02,
            }}
            whileTap={{
              scale: 0.98,
            }}
            className="ml-5"
          >
            <Link
              href="tel:+919217104219"
              className="
                group/phone

                relative
                flex
                items-center
                gap-3

                overflow-hidden

                rounded-xl

                border
                border-[#FF8500]/40

                bg-gradient-to-r
                from-[#F36B00]
                via-[#FF8500]
                to-[#FFC04D]

                px-3
                py-1.5

                shadow-[0_8px_22px_rgba(255,133,0,0.25)]

                transition-all
                duration-300

                hover:-translate-y-0.5

                hover:from-[#E96300]
                hover:via-[#F97800]
                hover:to-[#FFA31A]

                hover:shadow-[0_12px_30px_rgba(255,133,0,0.35)]
              "
            >
              {/* =============================================
                  BUTTON SHINE
              ============================================= */}

              <span
                className="
                  pointer-events-none
                  absolute
                  -left-[80%]
                  top-0

                  h-full
                  w-[55%]

                  skew-x-[-20deg]

                  bg-white/25

                  transition-all
                  duration-700

                  group-hover/phone:left-[130%]
                "
              />

              {/* =============================================
                  PHONE ICON
              ============================================= */}

              <span
                className="
                  relative
                  z-10

                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center

                  rounded-lg

                  bg-white/90
                  text-[#FF8500]

                  shadow-sm

                  transition-all
                  duration-300

                  group-hover/phone:scale-105
                  group-hover/phone:bg-white
                  group-hover/phone:text-[#F36B00]
                "
              >
                <FaPhoneAlt className="text-[13px]" />
              </span>

              {/* =============================================
                  PHONE NUMBER
              ============================================= */}

              <span
                className="
                  relative
                  z-10

                  whitespace-nowrap

                  text-[14px]
                  font-extrabold
                  tracking-[0.02em]

                  text-white
                "
              >
                +91 92171 04219
              </span>
            </Link>
          </motion.div>
        </div>

        {/* =================================================
            MOBILE MENU BUTTON
        ================================================= */}

        <motion.button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          whileTap={{
            scale: 0.9,
          }}
          whileHover={{
            scale: 1.05,
          }}
          className="
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center

            rounded-xl

            bg-gradient-to-br
            from-[#F36B00]
            via-[#FF8500]
            to-[#FFC04D]

            text-white

            shadow-[0_7px_20px_rgba(255,133,0,0.28)]

            transition-all
            duration-300

            hover:from-[#E96300]
            hover:via-[#F97800]
            hover:to-[#FFA31A]

            hover:shadow-[0_10px_25px_rgba(255,133,0,0.35)]

            lg:hidden
          "
        >
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div
                key="close"
                initial={{
                  opacity: 0,
                  rotate: -90,
                }}
                animate={{
                  opacity: 1,
                  rotate: 0,
                }}
                exit={{
                  opacity: 0,
                  rotate: 90,
                }}
                transition={{
                  duration: 0.2,
                }}
              >
                <HiX size={26} />
              </motion.div>
            ) : (
              <motion.div
                key="menu"
                initial={{
                  opacity: 0,
                  rotate: 90,
                }}
                animate={{
                  opacity: 1,
                  rotate: 0,
                }}
                exit={{
                  opacity: 0,
                  rotate: -90,
                }}
                transition={{
                  duration: 0.2,
                }}
              >
                <HiMenuAlt3 size={27} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* =====================================================
          MOBILE MENU
      ===================================================== */}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{
              opacity: 0,
              height: 0,
            }}
            animate={{
              opacity: 1,
              height: "auto",
            }}
            exit={{
              opacity: 0,
              height: 0,
            }}
            transition={{
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="
              overflow-hidden

              border-t
              border-gray-100

              bg-white

              shadow-[0_15px_30px_rgba(0,0,0,0.08)]

              lg:hidden
            "
          >
            <nav
              className="
                flex
                flex-col
                items-center
                justify-center

                px-5
                py-5
              "
            >
              {/* =================================================
                  MOBILE LINKS
              ================================================= */}

              {navLinks.map((link, index) => {
                const active = isActive(link.href);

                return (
                  <motion.div
                    key={link.label}
                    initial={{
                      opacity: 0,
                      y: -10,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      delay: 0.05 + index * 0.06,
                      duration: 0.3,
                    }}
                    className="w-full"
                  >
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`
                        group/mobile

                        flex
                        w-full
                        items-center
                        justify-center

                        py-4

                        text-center
                        text-[15px]
                        font-semibold
                        tracking-[0.08em]

                        transition-all
                        duration-300

                        ${
                          active
                            ? "text-[#FF8500]"
                            : "text-[#303030] hover:text-[#FF8500]"
                        }
                      `}
                    >
                      <span className="relative">
                        {link.label}

                        {/* =========================================
                            MOBILE ACTIVE / HOVER UNDERLINE
                        ========================================= */}

                        <span
                          className={`
                            absolute
                            -bottom-2
                            left-1/2

                            h-[3px]

                            -translate-x-1/2

                            rounded-full

                            bg-gradient-to-r
                            from-[#F36B00]
                            via-[#FF8500]
                            to-[#FFC04D]

                            transition-all
                            duration-300

                            ${
                              active
                                ? "w-full"
                                : "w-0 group-hover/mobile:w-full"
                            }
                          `}
                        />
                      </span>
                    </Link>
                  </motion.div>
                );
              })}

              {/* =================================================
                  MOBILE PHONE BUTTON
              ================================================= */}

              <motion.div
                initial={{
                  opacity: 0,
                  y: 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.3,
                  duration: 0.3,
                }}
                className="
                  mt-4
                  w-full
                  max-w-70
                "
              >
                <Link
                  href="tel:+919217104219"
                  onClick={() => setOpen(false)}
                  className="
                    group/mobilePhone

                    relative

                    flex
                    items-center
                    justify-center
                    gap-3

                    overflow-hidden

                    rounded-xl

                    border
                    border-[#FF8500]/40

                    bg-gradient-to-r
                    from-[#F36B00]
                    via-[#FF8500]
                    to-[#FFC04D]

                    px-4
                    py-2

                    shadow-[0_8px_22px_rgba(255,133,0,0.25)]

                    transition-all
                    duration-300

                    hover:from-[#E96300]
                    hover:via-[#F97800]
                    hover:to-[#FFA31A]

                    hover:shadow-[0_12px_28px_rgba(255,133,0,0.35)]
                  "
                >
                  {/* =============================================
                      MOBILE BUTTON SHINE
                  ============================================= */}

                  <span
                    className="
                      pointer-events-none

                      absolute
                      -left-[80%]
                      top-0

                      h-full
                      w-[55%]

                      skew-x-[-20deg]

                      bg-white/25

                      transition-all
                      duration-700

                      group-hover/mobilePhone:left-[130%]
                    "
                  />

                  {/* =============================================
                      MOBILE PHONE ICON
                  ============================================= */}

                  <span
                    className="
                      relative
                      z-10

                      flex
                      h-9
                      w-9
                      items-center
                      justify-center

                      rounded-lg

                      bg-white/90
                      text-[#FF8500]

                      shadow-sm

                      transition-all
                      duration-300

                      group-hover/mobilePhone:scale-105
                      group-hover/mobilePhone:bg-white
                      group-hover/mobilePhone:text-[#F36B00]
                    "
                  >
                    <FaPhoneAlt className="text-[13px]" />
                  </span>

                  {/* =============================================
                      MOBILE PHONE NUMBER
                  ============================================= */}

                  <span
                    className="
                      relative
                      z-10

                      text-[15px]
                      font-extrabold
                      text-white
                    "
                  >
                    +91 92171 04219
                  </span>
                </Link>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}