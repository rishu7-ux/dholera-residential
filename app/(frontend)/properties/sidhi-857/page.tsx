"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import {
  FaArrowRight,
  FaBuilding,
  FaCheck,
  FaFileAlt,
  FaHome,
  FaMapMarkerAlt,
  FaRoad,
  FaRulerCombined,
  FaShieldAlt,
} from "react-icons/fa";

import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";

/* =========================================================
   DATA
========================================================= */

const standoutFeatures = [
  "Clear legal status — the land is fully NA (Non-Agricultural) converted",
  "Genuine residential land use — legally classified and permitted for residential plotting",
  "Well-planned road network — 48-metre main road and 12-metre internal roads",
  "Flexible plot sizes — ranging from 390 sq. yd. to 450 sq. yd.",
  "Spread across 5,382 sq. yd. — creating a well-planned residential layout",
];

const projectSnapshot = [
  ["Project Name", "Sidhi 857"],
  ["Location", "TP Scheme 4-B2, Bhangadh Village, Dholera"],
  ["Land Type", "Residential Plot"],
  ["Legal Status", "NA Converted"],
  ["Land Use", "Residential"],
  ["Main Road", "48 Metre Wide"],
  ["Internal Roads", "12 Metre Wide"],
  ["Total Area", "5,382 Sq. Yards"],
  ["Available Plot Sizes", "390–450 Sq. Yards"],
];

const whoIsThisFor = [
  "First-time land investors — suitable for buyers looking for a lower-risk entry into Dholera SIR",
  "NRIs & outstation buyers — suitable for buyers looking for legally clear residential land",
  "Families planning to build a home — a residential plot option inside Dholera's planned growth corridor",
  "Long-term investors — suitable for buyers looking at infrastructure-led appreciation over time",
];

const bookingSteps = [
  "Plot Selection — choose your preferred plot based on size, location and budget",
  "Documentation Check — review TP scheme documents, NA conversion certificate and legal paperwork",
  "Booking & Agreement — secure the plot and complete the formal sale agreement",
  "Registration — register the final sale deed at the local sub-registrar office",
  "Possession & Future Use — hold, build or resell the plot after registration",
  "Remote Buying Support — outstation and overseas buyers can complete much of the process remotely",
];

const buyerProfiles = [
  "First-Time Land Investors",
  "NRIs & Outstation Buyers",
  "Families Planning for the Future",
  "Long-Term Investors",
];

const locationAdvantages = [
  "Inside TP Scheme 4-B2",
  "Bhangadh Village location",
  "Planned road and utility infrastructure",
  "Residential land-use planning",
];

const roadAdvantages = [
  "48-metre-wide main road",
  "12-metre internal roads",
  "Better vehicle movement",
  "Improved service and emergency access",
];

const investmentPoints = [
  "Residential development inside Dholera SIR",
  "Infrastructure-led growth potential",
  "Suitable for medium-to-long-term holding",
  "Potential future demand from residential growth",
];

const legalChecks = [
  "Verify NA conversion certificate",
  "Review TP Scheme 4-B2 documents",
  "Verify title chain and ownership records",
  "Check applicable approvals before purchase",
];

const faqs = [
  {
    q: "What is Sidhi 857?",
    a:
      "Sidhi 857 is a residential plotting project located in TP Scheme 4-B2, Bhangadh Village, within Dholera Special Investment Region (SIR). It offers residential plots ranging from 390 to 450 sq. yd.",
  },
  {
    q: "Is the land legally clear to purchase?",
    a:
      "The supplied project content states that the land is NA (Non-Agricultural) converted and is part of an approved TP Scheme. Buyers should independently verify legal documents before purchase.",
  },
  {
    q: 'What does "TP Scheme 4-B2" mean?',
    a:
      "TP Scheme 4-B2 is a designated Town Planning zone within Dholera SIR. Such schemes define planned road networks, utilities, plot boundaries and land-use zones.",
  },
  {
    q: "What plot sizes are available at Sidhi 857?",
    a:
      "Sidhi 857 offers residential plots ranging from 390 sq. yd. to 450 sq. yd.",
  },
  {
    q: "How wide are the roads in and around the project?",
    a:
      "The supplied project details state that the project is connected by a 48-metre main road with 12-metre internal roads.",
  },
  {
    q: "Is this a good time to invest in Dholera?",
    a:
      "Dholera is undergoing infrastructure development, but real estate investments involve market risk and future appreciation cannot be guaranteed.",
  },
  {
    q: "Can NRIs or buyers from other states purchase a plot in Sidhi 857?",
    a:
      "The supplied project content says buyers from outside Gujarat or abroad can complete much of the process remotely, subject to applicable legal and regulatory requirements.",
  },
  {
    q: "How do I book a plot or schedule a site visit?",
    a:
      "Contact the sales team through the website to check current availability, pricing and site visit options.",
  },
];

const recentProperties = [
  
  {
    title: "Ridhi 966/1 SCO Plots",
    image: "/images/ridhi-966-1.png",
    size: "423 - 590 Sq. Yd.",
    slug: "ridhi-966-1",
  },
  {
    title: "Ridhi 249/2 — Premium SCO Plots",
    image: "/images/Ridhi-249-2.jpg",
    size: "390 | 578 | 687 Sq. Yards",
    slug: "ridhi-249-2",
  },
  {
    title: "Sidhi 857 — Residential Plot",
    image: "/images/Sidhi-857.jpg",
    size: "390 - 450 Sq. Yd.",
    slug: "sidhi-857",
  },
  
];

/* =========================================================
   ANIMATION
========================================================= */

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 35,
  },

  visible: {
    opacity: 1,
    y: 0,

    transition: {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

/* =========================================================
   SECTION HEADING
========================================================= */

function SectionHeading({
  small,
  title,
}: {
  small?: string;
  title: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{
        once: true,
        amount: 0.15,
      }}
      className="mb-7"
    >
      {small && (
        <div className="mb-3 flex items-center gap-3">
          <span className="h-0.5 w-8 bg-[#C94F00]" />

          <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#FF7A00]">
            {small}
          </span>
        </div>
      )}

      <h2 className="text-3xl font-extrabold leading-tight text-[#081A3A] md:text-4xl">
        {title}
      </h2>
    </motion.div>
  );
}

/* =========================================================
   BULLET CARDS
========================================================= */

function BulletCards({ items }: { items: string[] }) {
  return (
    <div className="mt-7 grid gap-4 sm:grid-cols-2">
      {items.map((item, index) => (
        <motion.div
          key={index}
          initial={{
            opacity: 0,
            y: 25,
            scale: 0.97,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          viewport={{
            once: true,
            amount: 0.15,
          }}
          transition={{
            delay: index * 0.06,
            duration: 0.45,
          }}
          whileHover={{
            y: -5,
          }}
          className="
            group
            relative
            overflow-hidden
            rounded-2xl
            border
            border-[#FF7A00]/10
            bg-white
            p-5
            shadow-[0_10px_35px_rgba(8,26,58,0.06)]
            transition-all
            duration-300

            hover:border-[#FF7A00]/30
            hover:bg-[#FFF7EF]
            hover:shadow-[0_18px_45px_rgba(255,122,0,0.12)]
          "
        >
          <div className="flex items-start gap-4">
            <span
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-[#FFF0E2]
                text-sm
                text-[#FF7A00]
                transition-all
                duration-300

                group-hover:scale-110
                group-hover:bg-[#C94F00]
                group-hover:text-white
              "
            >
              <FaCheck />
            </span>

            <p className="text-[15px] font-medium leading-7 text-gray-700">
              {item}
            </p>
          </div>

          <span
            className="
              absolute
              bottom-0
              left-0
              h-0.75
              w-0
              bg-[#C94F00]
              transition-all
              duration-500

              group-hover:w-full
            "
          />
        </motion.div>
      ))}
    </div>
  );
}

/* =========================================================
   DATA TABLE
========================================================= */

function DataTable({ rows }: { rows: string[][] }) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 30,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
      }}
      transition={{
        duration: 0.6,
      }}
      className="
        mt-7
        overflow-hidden
        rounded-2xl
        border
        border-[#FF7A00]/10
        bg-white
        shadow-[0_15px_40px_rgba(8,26,58,0.07)]
      "
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={index}
                className="
                  border-b
                  border-gray-100
                  transition-colors
                  duration-300

                  odd:bg-white
                  even:bg-[#FFF9F4]
                  hover:bg-[#FFF0E2]
                "
              >
                <td className="px-5 py-4 text-sm font-extrabold text-[#081A3A] md:text-base">
                  {row[0]}
                </td>

                <td className="px-5 py-4 text-sm font-medium text-gray-700 md:text-base">
                  {row[1]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function Page() {
  const [, setPopupOpen] = useState(false);

  return (
    <>
      <TopBar />

      <Header />

      {/* =====================================================
          SIDHI 857 - COMPACT ORANGE HERO
      ===================================================== */}

      <section className="relative overflow-hidden bg-[#FF7A00]">
        {/* ANIMATED RIGHT BACKGROUND DESIGN */}

        <motion.div
          className="
            pointer-events-none
            absolute
            -right-20
            -top-28.75
            h-77.5
            w-77.5
            rotate-12
            border-38
            border-white/10
          "
          animate={{
            rotate: [12, 16, 12],
            scale: [1, 1.04, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* SECOND BACKGROUND SHAPE */}

        <motion.div
          className="
            pointer-events-none
            absolute
            -bottom-30
            right-[8%]
            h-55
            w-105
            rotate-12
            bg-white/6
          "
          animate={{
            x: [0, 25, 0],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* SOFT BACKGROUND GLOW */}

        <motion.div
          className="
            pointer-events-none
            absolute
            -bottom-20
            right-[30%]
            h-45
            w-45
            rounded-full
            bg-white/10
            blur-[70px]
          "
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* HERO CONTENT */}

        <div
          className="
            relative
            z-10
            mx-auto
            flex
            min-h-40
            max-w-7xl
            items-center
            px-4
            py-5

            sm:min-h-42.5
            sm:px-6
            sm:py-5

            md:min-h-45
            md:py-6

            lg:min-h-47.5
            lg:px-8
            lg:py-6
          "
        >
          <motion.div
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
              ease: [0.22, 1, 0.36, 1],
            }}
            className="w-full max-w-4xl"
          >
            {/* PREMIUM LABEL */}

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
                delay: 0.1,
              }}
              className="mb-3 flex items-center gap-3"
            >
              <motion.span
                initial={{
                  width: 0,
                }}
                animate={{
                  width: 36,
                }}
                transition={{
                  duration: 0.7,
                  delay: 0.2,
                }}
                className="h-0.5 shrink-0 bg-white"
              />

              <span
                className="
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.22em]
                  text-white

                  sm:text-[10px]
                  sm:tracking-[0.24em]

                  md:text-[11px]
                "
              >
                Premium Residential Investment
              </span>
            </motion.div>

            {/* MAIN HEADING */}

            <motion.h1
              initial={{
                opacity: 0,
                y: 15,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.6,
                delay: 0.15,
              }}
              className="
                text-[27px]
                font-extrabold
                leading-[1.08]
                tracking-[-0.02em]
                text-white

                sm:text-[31px]
                md:text-[35px]
                lg:text-[38px]
              "
            >
              <span className="block">Sidhi 857</span>

              <span className="mt-1 block">
                Residential Plots in Dholera
              </span>
            </motion.h1>

            {/* BREADCRUMB */}

            <motion.div
              initial={{
                opacity: 0,
                y: 12,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.55,
                delay: 0.28,
              }}
              className="
                mt-4
                flex
                flex-wrap
                items-center
                gap-2
                text-[12px]
                font-medium
                text-white/90

                sm:text-[13px]
                md:text-sm
              "
            >
              <Link
                href="/"
                className="
                  transition-all
                  duration-300
                  hover:-translate-y-px
                  hover:text-[#081A3A]
                "
              >
                Home
              </Link>

              <span className="font-semibold text-white/70">/</span>

              <Link
                href="/properties"
                className="
                  transition-all
                  duration-300
                  hover:-translate-y-px
                  hover:text-[#081A3A]
                "
              >
                Properties
              </Link>

              <span className="font-semibold text-white/70">/</span>

              <span className="font-semibold text-white">
                Sidhi 857
              </span>
            </motion.div>
          </motion.div>
        </div>

        {/* BOTTOM BORDER */}

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
            ease: "easeOut",
          }}
          style={{
            transformOrigin: "left",
          }}
          className="
            absolute
            bottom-0
            left-0
            h-0.5
            w-full
            bg-white/20
          "
        />

        {/* SMALL LIGHT SWEEP */}

        <motion.div
          className="
            pointer-events-none
            absolute
            -left-37.5
            top-0
            h-full
            w-25
            rotate-12
            bg-linear-to-r
            from-transparent
            via-white/10
            to-transparent
            blur-xl
          "
          animate={{
            x: [0, 1600],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            repeatDelay: 4,
            ease: "easeInOut",
          }}
        />
      </section>

      {/* =====================================================
          ANIMATED BACKGROUND IMAGE
      ===================================================== */}

      <section className="relative bg-white pb-28 md:pb-32">
        <div
          className="
            group/main-image
            relative
            h-100
            w-full
            overflow-hidden
            sm:h-107.5
            md:h-125
            lg:h-140
          "
        >
          {/* SLOW BACKGROUND PHOTO ANIMATION */}

          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.02, x: 0, y: 0 }}
            animate={{
              scale: [1.02, 1.08, 1.04, 1.02],
              x: [0, -8, 6, 0],
              y: [0, -4, 3, 0],
            }}
            transition={{
              duration: 16,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Image
              src="/images/sidhi residential.png"
              alt="Sidhi 857 Residential Plot Dholera"
              fill
              priority
              sizes="100vw"
              className="
                scale-[1.03]
                object-cover
                blur-[3px]
                brightness-[0.68]
                saturate-[0.75]
              "
            />
          </motion.div>

          {/* SOLD OUT DARK / BLUR OVERLAY */}
          <div className="pointer-events-none absolute inset-0 z-5 bg-[#081A3A]/22 backdrop-blur-[1px]" />

          {/* SOLD OUT LABEL */}
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="-rotate-12 border-y-4 border-white/90 bg-[#C94F00]/95 px-10 py-3 text-center text-2xl font-black uppercase tracking-[0.22em] text-white shadow-[0_14px_40px_rgba(74,24,0,0.38)] backdrop-blur-[2px] sm:px-14 sm:py-4 sm:text-4xl md:text-5xl">
              Sold Out
            </div>
          </div>

          {/* MOVING ORANGE LIGHT */}

          <motion.div
            className="
              pointer-events-none
              absolute
              -left-65
              -top-10
              h-[125%]
              w-57.5
              rotate-15
              bg-linear-to-r
              from-transparent
              via-[#FF7A00]/20
              to-transparent
              blur-2xl
            "
            animate={{ x: [0, 1800] }}
            transition={{
              duration: 9,
              repeat: Infinity,
              repeatDelay: 3,
              ease: "easeInOut",
            }}
          />

          {/* SOFT ORANGE GLOW */}

          <motion.div
            className="
              pointer-events-none
              absolute
              right-[8%]
              top-[15%]
              h-55
              w-55
              rounded-full
              bg-[#FF7A00]/10
              blur-[70px]
            "
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.25, 0.5, 0.25],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* BOTTOM GRADIENT */}

          <div
            className="
              pointer-events-none
              absolute
              inset-x-0
              bottom-0
              h-44
              bg-linear-to-t
              from-[#081A3A]/45
              via-[#081A3A]/10
              to-transparent
            "
          />

          {/* ORANGE BOTTOM BORDER */}

          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: "100%" }}
            viewport={{ once: true }}
            transition={{ duration: 1.3, ease: "easeOut" }}
            className="
              absolute
              bottom-0
              left-0
              h-0.75
              bg-[#FF7A00]
              shadow-[0_0_20px_rgba(255,122,0,0.55)]
            "
          />
        </div>

        {/* =================================================
            OVERLAPPING PROPERTY CARD
        ================================================= */}

        <div
          className="
            relative
            z-20
            mx-auto
            -mt-24
            max-w-7xl
            px-5
            sm:px-6
            lg:-mt-28
            lg:px-8
          "
        >
          <motion.div
            initial={{
              opacity: 0,
              y: 50,
              scale: 0.98,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            viewport={{
              once: true,
              amount: 0.15,
            }}
            transition={{
              duration: 0.75,
              ease: [0.22, 1, 0.36, 1],
            }}
            whileHover={{
              y: -4,
            }}
            className="
              overflow-hidden
              rounded-[28px]
              border
              border-[#FF7A00]/30
              bg-white
              shadow-[0_30px_80px_rgba(8,26,58,0.18)]
              transition-all
              duration-500
              hover:border-[#FF7A00]/60
              hover:shadow-[0_35px_90px_rgba(255,122,0,0.16)]
            "
          >
            {/* =================================================
                TITLE + PROPERTY TYPE
            ================================================= */}

            <div
              className="
                flex
                flex-col
                gap-3
                px-4
                py-4

                sm:gap-6
                sm:px-6
                sm:py-6

                md:px-8
                md:py-8

                lg:flex-row
                lg:items-center
                lg:justify-between
                lg:px-10
              "
            >
              {/* LEFT */}

              <div>
                <div className="flex items-center gap-2 text-[#FF7A00]">
                  <span
                    className="
                      flex
                      h-7
                      w-7
                      items-center
                      justify-center
                      rounded-lg
                      bg-[#FFF0E2]

                      sm:h-8
                      sm:w-8
                    "
                  >
                    <FaMapMarkerAlt className="text-[10px] sm:text-xs" />
                  </span>

                  <span className="text-xs font-bold sm:text-sm">
                    Bhangadh Village, Dholera
                  </span>
                </div>

                <h2
                  className="
                    mt-2.5
                    text-[20px]
                    font-extrabold
                    leading-[1.2]
                    text-[#081A3A]

                    sm:mt-4
                    sm:text-3xl

                    md:text-[34px]
                  "
                >
                  Sidhi 857 Residential Plots
                </h2>
              </div>

              {/* PROPERTY TYPE */}

              <motion.div
                whileHover={{ y: -3 }}
                className="shrink-0 rounded-2xl border border-[#C94F00]/20 bg-[#FFF0E6] px-4 py-3 shadow-[0_8px_24px_rgba(201,79,0,0.10)] sm:px-6 sm:py-4 lg:text-right"
              >
                <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#9A5A35] sm:text-[10px]">
                  Availability
                </p>
                <p className="mt-1 text-[22px] font-black leading-none text-[#C94F00] sm:text-2xl md:text-3xl">
                  SOLD OUT
                </p>
                <p className="mt-1.5 text-[10px] font-semibold text-[#8B6B58] sm:text-xs">
                  No inventory currently available
                </p>
              </motion.div>
            </div>

            {/* DIVIDER */}

            <div className="mx-4 h-px bg-gray-100 sm:mx-6 md:mx-8 lg:mx-10" />

            {/* =================================================
                PROPERTY DETAILS
                SAME RESPONSIVE STYLE AS RIDHI 872
            ================================================= */}

            <div
              className="
                px-4
                pb-1
                pt-0

                sm:px-6
                sm:py-6

                md:px-8

                lg:px-10
              "
            >
              <div
                className="
                  grid
                  grid-cols-2
                  gap-0

                  overflow-hidden

                  rounded-xl
                  border
                  border-[#FF7A00]/15

                  bg-[#FFF9F4]

                  sm:gap-3
                  sm:border-0
                  sm:bg-transparent
                  sm:rounded-none

                  lg:grid-cols-5
                "
              >
                {[
                  {
                    icon: <FaRulerCombined />,
                    title: "Total Area",
                    value: "5,382 Sq. Yd.",
                  },
                  {
                    icon: <FaHome />,
                    title: "Plot Sizes",
                    value: "390 - 450 Sq. Yd.",
                  },
                  {
                    icon: <FaRoad />,
                    title: "Main Road",
                    value: "48 Metres",
                  },
                  {
                    icon: <FaRoad />,
                    title: "Internal Roads",
                    value: "12 Metres",
                  },
                  {
                    icon: <FaBuilding />,
                    title: "TP Scheme",
                    value: "TP 4-B2",
                  },
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{
                      opacity: 0,
                      y: 8,
                    }}
                    whileInView={{
                      opacity: 1,
                      y: 0,
                    }}
                    viewport={{
                      once: true,
                    }}
                    transition={{
                      delay: index * 0.04,
                      duration: 0.3,
                    }}
                    whileHover={{
                      y: -2,
                    }}
                    className={`
                      group

                      flex
                      min-h-13
                      items-center

                      bg-[#FFF9F4]

                      px-2
                      py-1.5

                      transition-all
                      duration-300

                      hover:bg-[#FFF0E2]

                      sm:block
                      sm:min-h-32.5
                      sm:rounded-2xl
                      sm:border
                      sm:border-[#FF7A00]/25
                      sm:p-4

                      sm:hover:-translate-y-1
                      sm:hover:border-[#FF7A00]
                      sm:hover:bg-[#FFF4E8]
                      sm:hover:shadow-[0_14px_32px_rgba(255,122,0,0.16)]

                      ${
                        index === 0
                          ? "border-b border-r border-[#FF7A00]/15 sm:border"
                          : ""
                      }

                      ${
                        index === 1
                          ? "border-b border-[#FF7A00]/15 sm:border"
                          : ""
                      }

                      ${
                        index === 2
                          ? "border-b border-r border-[#FF7A00]/15 sm:border"
                          : ""
                      }

                      ${
                        index === 3
                          ? "border-b border-[#FF7A00]/15 sm:border"
                          : ""
                      }

                      ${
                        index === 4
                          ? "col-span-2 border-[#FF7A00]/15 sm:col-span-1 sm:border"
                          : ""
                      }
                    `}
                  >
                    <span
                      className="
                        flex
                        h-4.5
                        w-4.5
                        shrink-0
                        items-center
                        justify-center
                        rounded-sm
                        bg-[#FFF0E2]
                        text-[7px]
                        text-[#FF7A00]
                        transition-all
                        duration-300

                        group-hover:bg-[#FF7A00]
                        group-hover:text-white

                        sm:h-9
                        sm:w-9
                        sm:rounded-xl
                        sm:text-sm
                      "
                    >
                      {item.icon}
                    </span>

                    <div className="ml-1.5 min-w-0 sm:ml-0">
                      <p
                        className="
                          text-[9px]
                          font-bold
                          uppercase
                          leading-tight
                          tracking-[0.06em]
                          text-gray-500

                          sm:mt-3
                          sm:text-[12px]
                          sm:leading-normal
                          sm:tracking-[0.14em]

                          md:text-[13px]
                        "
                      >
                        {item.title}
                      </p>

                      <p
                        className="
                          mt-1
                          whitespace-nowrap
                          text-[12px]
                          font-extrabold
                          leading-tight
                          text-[#081A3A]
                          sm:mt-1.5
                          sm:text-[15px]
                          sm:leading-5
                        "
                      >
                        {item.value}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* =================================================
                BUTTONS
            ================================================= */}

            <div
              className="
                flex
                gap-2
                border-t
                border-gray-100
                bg-[#FFFBF7]
                px-4
                py-2.5
                sm:flex-row
                sm:py-3
                md:px-8
                lg:px-10
              "
            >
              {/* ENQUIRE NOW */}

              <motion.button
                type="button"
                onClick={() => setPopupOpen(true)}
                whileHover={{
                  y: -2,
                  scale: 1.01,
                }}
                whileTap={{
                  scale: 0.97,
                }}
                className="
                  group

                  flex
                  h-10
                  flex-1
                  items-center
                  justify-center
                  gap-1.5

                  rounded-lg

                  bg-[#FF7A00]

                  px-2

                  text-[11px]
                  font-bold
                  text-white

                  shadow-[0_6px_18px_rgba(255,122,0,0.20)]

                  transition-all
                  duration-300

                  hover:bg-[#FF9638]
                  hover:shadow-[0_10px_25px_rgba(255,122,0,0.28)]

                  sm:h-auto
                  sm:flex-none
                  sm:rounded-xl
                  sm:px-5
                  sm:py-3
                  sm:text-[13px]
                "
              >
                <span className="whitespace-nowrap">Sold Out</span>

                <FaArrowRight
                  className="
                    text-[8px]
                    transition-transform
                    duration-300

                    group-hover:translate-x-1

                    sm:text-xs
                  "
                />
              </motion.button>

              {/* CONTACT */}

              <motion.div
                whileHover={{
                  y: -2,
                  scale: 1.01,
                }}
                whileTap={{
                  scale: 0.97,
                }}
                className="flex flex-1 sm:flex-none"
              >
                <Link
                  href="/contact-us"
                  className="
                    flex
                    h-10
                    w-full
                    items-center
                    justify-center

                    rounded-lg

                    border
                    border-[#FF7A00]

                    bg-white

                    px-2

                    text-[11px]
                    font-bold
                    text-[#FF7A00]

                    transition-all
                    duration-300

                    hover:bg-[#FFF0E2]

                    sm:h-auto
                    sm:w-auto
                    sm:rounded-xl
                    sm:px-5
                    sm:py-3
                    sm:text-[13px]
                  "
                >
                  Contact Us
                </Link>
              </motion.div>
            </div>

          </motion.div>
        </div>
      </section>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_360px]">
            {/* =================================================
                LEFT
            ================================================= */}

            <main>
              {/* INTRODUCTION */}

              <section>
                <SectionHeading
                  small="Premium Residential Property"
                  title="Sidhi 857 – Your Slice of Dholera's Future, Right in TP 4-B2"
                />

                <motion.h3
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{
                    once: true,
                  }}
                  className="mb-5 text-2xl font-extrabold text-[#FF7A00]"
                >
                  Own a Residential Plot in One of Dholera&apos;s Most Promising
                  TP Schemes
                </motion.h3>

                <motion.p
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{
                    once: true,
                  }}
                  className="text-lg font-medium leading-9 text-gray-700"
                >
                  If you&apos;ve been watching Dholera Special Investment Region
                  grow and wondering when the right time to invest is — this
                  might be it. Sidhi 857 is a thoughtfully planned residential
                  plot project located in Bhangadh Village, under TP Scheme
                  4-B2, one of the well-mapped and government-approved town
                  planning zones within Dholera SIR.
                </motion.p>

                <motion.p
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{
                    once: true,
                  }}
                  className="mt-6 text-lg font-medium leading-9 text-gray-700"
                >
                  This isn&apos;t just another plot on a map. It&apos;s a
                  legally clear, NA-converted residential layout designed for
                  people who want to build a home, park an investment, or
                  simply secure a foothold in India&apos;s first greenfield
                  smart city before prices climb further.
                </motion.p>
              </section>

              {/* =================================================
                  WHY CHOOSE
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  small="Project Advantage"
                  title="Why Choose Sidhi 857?"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  Dholera is no longer just a future story. Roads, airport
                  infrastructure, industrial development and residential
                  planning are steadily expanding across the region. Bhangadh
                  Village within TP 4-B2 is positioned to benefit from this
                  growth.
                </p>

                <BulletCards items={standoutFeatures} />
              </section>

              {/* =================================================
                  SNAPSHOT
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  small="Project Overview"
                  title="Project Snapshot"
                />

                <DataTable rows={projectSnapshot} />
              </section>

              {/* =================================================
                  LOCATION
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  small="Location"
                  title="Location That Works in Your Favour"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  Being part of TP Scheme 4-B2 matters because Town Planning
                  schemes form the backbone of Dholera&apos;s development.
                  Roads, drainage, electricity, utilities and other
                  infrastructure are planned around these zones.
                </p>

                <p className="mt-6 text-lg font-medium leading-9 text-gray-700">
                  A plot located inside an approved TP scheme such as Sidhi 857
                  sits on a stronger planning footing than land outside these
                  boundaries, both in terms of infrastructure planning and
                  future accessibility.
                </p>

                <BulletCards items={locationAdvantages} />
              </section>

              {/* =================================================
                  REAL USE
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  small="Residential Use"
                  title="Built for Real Use, Not Just Resale"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  According to the supplied project information, Sidhi 857 is
                  already NA converted and carries residential land-use
                  permission. This means buyers are not relying on a future
                  conversion promise before considering residential
                  development.
                </p>
              </section>

              {/* =================================================
                  WHO IS IT FOR
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  small="Buyer Profile"
                  title="Who Is This For?"
                />

                <BulletCards items={whoIsThisFor} />
              </section>

              {/* =================================================
                  TP SCHEME
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  small="Town Planning"
                  title="Understanding TP 4-B2 and Why It Matters"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  Dholera SIR is divided into Town Planning schemes that define
                  road networks, utility corridors, public areas and land use
                  before development moves ahead. TP 4-B2 is one such planned
                  zone, and Bhangadh Village falls within its boundary.
                </p>

                <p className="mt-6 text-lg font-medium leading-9 text-gray-700">
                  Buying within an approved TP scheme provides clearer planned
                  road access and land-use structure compared with land outside
                  finalised planning boundaries.
                </p>
              </section>

              {/* =================================================
                  ROAD
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  small="Connectivity"
                  title="The Road Network Advantage"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  Sidhi 857 is planned along a 48-metre-wide main road, while
                  12-metre internal roads connect plots inside the layout.
                </p>

                <p className="mt-6 text-lg font-medium leading-9 text-gray-700">
                  Wider roads can improve vehicle movement, service access and
                  overall layout usability as surrounding development
                  increases.
                </p>

                <BulletCards items={roadAdvantages} />
              </section>

              {/* =================================================
                  PLOT SIZE
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  small="Plot Options"
                  title="Plot Sizes That Give You Options"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  Sidhi 857 offers plot sizes ranging from approximately 390
                  sq. yd. to 450 sq. yd., allowing buyers to choose based on
                  their budget, home plans and long-term investment strategy.
                </p>

                <p className="mt-6 text-lg font-medium leading-9 text-gray-700">
                  The total project area is approximately 5,382 sq. yd.,
                  creating a compact residential layout while still offering
                  meaningful plot sizes.
                </p>
              </section>

              {/* =================================================
                  INVESTMENT
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  small="Investment"
                  title="Is Dholera the Right Place to Buy Land Right Now?"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  Dholera has been discussed as a major smart-city development
                  for years. Infrastructure such as roads, utilities, airport
                  development and industrial activity can influence residential
                  land demand over time.
                </p>

                <BulletCards items={investmentPoints} />

              </section>

              {/* =================================================
                  BOOKING
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  small="Buying Process"
                  title="What Happens After You Book a Plot?"
                />

                <BulletCards items={bookingSteps} />
              </section>

              {/* =================================================
                  BUYERS
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  small="Investor Profile"
                  title="Who Should Consider Sidhi 857?"
                />

                <BulletCards items={buyerProfiles} />
              </section>

              {/* =================================================
                  LEGAL
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  small="Documentation"
                  title="Important Documents to Verify"
                />

                <div className="mb-7 flex items-center gap-3">
                  <span
                    className="
                      flex
                      h-11
                      w-11
                      items-center
                      justify-center
                      rounded-xl
                      bg-[#FFF0E2]
                      text-[#FF7A00]
                    "
                  >
                    <FaFileAlt />
                  </span>

                  <p className="font-semibold text-gray-600">
                    Always verify legal documentation before purchasing land.
                  </p>
                </div>

                <BulletCards items={legalChecks} />
              </section>

              {/* =================================================
                  FAQ
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  small="Questions"
                  title="Frequently Asked Questions"
                />

                <div className="space-y-4">
                  {faqs.map((faq, index) => (
                    <motion.article
                      key={faq.q}
                      initial={{
                        opacity: 0,
                        y: 25,
                      }}
                      whileInView={{
                        opacity: 1,
                        y: 0,
                      }}
                      viewport={{
                        once: true,
                      }}
                      transition={{
                        delay: index * 0.05,
                        duration: 0.45,
                      }}
                      whileHover={{
                        y: -3,
                      }}
                      className="
                        rounded-2xl
                        border
                        border-[#FF7A00]/10
                        bg-white
                        p-6
                        shadow-[0_10px_30px_rgba(8,26,58,0.05)]
                        transition-all
                        duration-300

                        hover:border-[#FF7A00]/30
                        hover:bg-[#FFF7EF]
                      "
                    >
                      <div className="flex items-start gap-4">
                        <span
                          className="
                            flex
                            h-9
                            min-w-9
                            items-center
                            justify-center
                            rounded-xl
                            bg-[#FF7A00]
                            text-sm
                            font-bold
                            text-white
                          "
                        >
                          {index + 1}
                        </span>

                        <div>
                          <h3 className="text-lg font-extrabold text-[#081A3A]">
                            {faq.q}
                          </h3>

                          <p className="mt-3 leading-7 text-gray-600">
                            {faq.a}
                          </p>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </section>

              {/* =================================================
                  NEXT STEP
              ================================================= */}

              <motion.section
                initial={{
                  opacity: 0,
                  y: 30,
                }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                }}
                viewport={{
                  once: true,
                }}
                className="
                  mt-16
                  rounded-[28px]
                  border
                  border-[#FF7A00]/15
                  bg-[#FFF4E8]
                  p-7
                  md:p-9
                "
              >
                <div className="flex items-center gap-3 text-[#FF7A00]">
                  <FaShieldAlt />

                  <span className="text-xs font-bold uppercase tracking-[0.18em]">
                    Next Step
                  </span>
                </div>

                <h2 className="mt-4 text-3xl font-extrabold text-[#081A3A]">
                  Ready to Explore Sidhi 857?
                </h2>

                <p className="mt-4 text-lg leading-8 text-gray-700">
                  Sidhi 857 offers residential plots ranging from 390 to 450
                  sq. yd. in TP 4-B2, Bhangadh Village. Contact our property
                  team for current pricing, availability and site-visit
                  options.
                </p>

                <motion.button
                  type="button"
                  disabled
                  aria-disabled="true"
                  whileHover={{
                    y: -3,
                    scale: 1.02,
                  }}
                  whileTap={{
                    scale: 0.98,
                  }}
                  className="
                    mt-7
                    inline-flex
                    items-center
                    gap-3
                    rounded-xl
                    bg-[#FF7A00]
                    px-7
                    py-4
                    font-bold
                    text-white
                    shadow-[0_10px_25px_rgba(255,122,0,0.22)]
                    transition-all
                    duration-300

                    hover:bg-[#FF9638]
                    hover:shadow-[0_15px_30px_rgba(255,122,0,0.28)]
                  "
                >
                  Sold Out

                  <FaArrowRight />
                </motion.button>
              </motion.section>

              {/* =================================================
                  BROCHURE
              ================================================= */}

              <motion.section
                initial={{
                  opacity: 0,
                  y: 30,
                }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                }}
                viewport={{
                  once: true,
                }}
                className="
                  mt-8
                  rounded-[28px]
                  border
                  border-[#FF7A00]/15
                  bg-white
                  p-7
                  shadow-[0_15px_45px_rgba(8,26,58,0.07)]
                  md:p-9
                "
              >
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7A00]">
                  Project Brochure
                </span>

                <h2 className="mt-3 text-3xl font-extrabold text-[#081A3A]">
                  Download Sidhi 857 Brochure
                </h2>

                <p className="mt-4 text-lg leading-8 text-gray-700">
                  Get complete project information, plot details and
                  documentation information.
                </p>

                <motion.a
                  href="/brochures/Sidhi857.pdf"
                  download
                  whileHover={{
                    y: -3,
                    scale: 1.02,
                  }}
                  whileTap={{
                    scale: 0.98,
                  }}
                  className="
                    mt-7
                    inline-flex
                    items-center
                    gap-3
                    rounded-xl
                    bg-[#FF7A00]
                    px-7
                    py-4
                    font-bold
                    text-white
                    shadow-[0_10px_25px_rgba(255,122,0,0.22)]
                    transition-all
                    duration-300

                    hover:bg-[#FF9638]
                    hover:shadow-[0_15px_30px_rgba(255,122,0,0.28)]
                  "
                >
                  Download Brochure

                  <FaArrowRight />
                </motion.a>
              </motion.section>
            </main>

            {/* =================================================
                SIDEBAR
            ================================================= */}

            <aside className="space-y-7 self-start lg:sticky lg:top-28">
              {/* =================================================
                  ENQUIRY CARD
              ================================================= */}

              <motion.div
                initial={{
                  opacity: 0,
                  x: 30,
                }}
                whileInView={{
                  opacity: 1,
                  x: 0,
                }}
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.6,
                }}
                className="
                  relative
                  overflow-hidden
                  rounded-[26px]
                  border
                  border-[#FF7A00]/15
                  bg-[#FFF4E8]
                  p-6
                  shadow-[0_20px_55px_rgba(255,122,0,0.13)]
                "
              >
                {/* TOP LINE */}

                <span className="absolute left-0 top-0 h-1 w-full bg-[#FF7A00]" />

                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7A00]">
                  Property Enquiry
                </span>

                <h3 className="mt-2 text-3xl font-extrabold text-[#081A3A]">
                  Interested in Sidhi 857?
                </h3>

                <p className="mt-3 text-sm leading-6 text-gray-600">
                  Speak with our property team for pricing, availability and
                  site visit information.
                </p>

                <motion.button
                  type="button"
                  disabled
                  aria-disabled="true"
                  whileHover={{
                    y: -3,
                    scale: 1.01,
                  }}
                  whileTap={{
                    scale: 0.98,
                  }}
                  className="
                    group
                    mt-6
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-[#FF7A00]
                    py-4
                    font-bold
                    text-white
                    shadow-[0_10px_25px_rgba(255,122,0,0.22)]
                    transition-all
                    duration-300

                    hover:bg-[#FF9638]
                  "
                >
                  Sold Out

                  <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-2" />
                </motion.button>
              </motion.div>

              {/* =================================================
                  RECENT PROPERTIES
              ================================================= */}

              <motion.div
                initial={{
                  opacity: 0,
                  x: 30,
                }}
                whileInView={{
                  opacity: 1,
                  x: 0,
                }}
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.6,
                  delay: 0.1,
                }}
                className="
                  relative
                  overflow-hidden
                  rounded-[26px]
                  border
                  border-[#FF7A00]/20
                  bg-white
                  p-6
                  shadow-[0_15px_45px_rgba(8,26,58,0.07)]
                "
              >
                <motion.div
                  className="
                    pointer-events-none
                    absolute
                    -right-20
                    -top-20
                    h-40
                    w-40
                    rounded-full
                    bg-[#FF7A00]/5
                    blur-[35px]
                  "
                  animate={{
                    scale: [1, 1.35, 1],
                    x: [0, -20, 0],
                  }}
                  transition={{
                    duration: 7,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                <span className="relative z-10 text-xs font-bold uppercase tracking-[0.18em] text-[#FF7A00]">
                  Explore More
                </span>

                <h3 className="relative z-10 mt-2 text-2xl font-extrabold text-[#081A3A]">
                  Recent Properties
                </h3>

                <span className="relative z-10 mt-3 block h-0.75 w-10 rounded-full bg-[#FF7A00]" />

                <div className="relative z-10 mt-6 space-y-3">
                  {recentProperties.map((property, index) => (
                    <motion.div
                      key={property.slug}
                      initial={{
                        opacity: 0,
                        x: 15,
                      }}
                      whileInView={{
                        opacity: 1,
                        x: 0,
                      }}
                      viewport={{
                        once: true,
                      }}
                      transition={{
                        delay: index * 0.06,
                        duration: 0.4,
                      }}
                    >
                      <Link
                        href={`/properties/${property.slug}`}
                        className="
                          group
                          relative
                          flex
                          items-center
                          gap-3
                          overflow-hidden
                          rounded-xl
                          border
                          border-[#FF7A00]/10
                          bg-white
                          p-2.5
                          transition-all
                          duration-500

                          hover:translate-x-1
                          hover:border-[#FF7A00]/40
                          hover:bg-[#FFF8F2]
                          hover:shadow-[0_12px_30px_rgba(255,122,0,0.12)]
                        "
                      >
                        {/* IMAGE */}

                        <motion.div
                          whileHover={{
                            scale: 1.06,
                            rotate: 1,
                          }}
                          transition={{
                            duration: 0.3,
                          }}
                          className="
                            relative
                            h-18
                            w-22
                            shrink-0
                            overflow-hidden
                            rounded-xl
                            border-2
                            border-[#FF7A00]/50
                            bg-[#FFF4E8]
                            p-0.5
                            shadow-[0_7px_18px_rgba(255,122,0,0.10)]
                            transition-all
                            duration-300
                            group-hover:border-[#FF7A00]
                            group-hover:shadow-[0_12px_28px_rgba(255,122,0,0.25)]
                          "
                        >
                          <div className="relative h-full w-full overflow-hidden rounded-[9px]">
                            <Image
                              src={property.image}
                              alt={property.title}
                              fill
                              sizes="88px"
                              className="
                                object-cover
                                transition-all
                                duration-700
                                ease-out
                                group-hover:scale-[1.15]
                                group-hover:brightness-105
                              "
                            />

                            <div
                              className="
                                absolute
                                inset-0
                                bg-[#FF7A00]/0
                                transition-all
                                duration-500
                                group-hover:bg-[#FF7A00]/10
                              "
                            />

                            <span
                              className="
                                pointer-events-none
                                absolute
                                -left-12
                                top-0
                                h-full
                                w-8
                                rotate-12
                                bg-white/35
                                blur-sm
                                transition-all
                                duration-700
                                group-hover:left-[120%]
                              "
                            />
                          </div>
                        </motion.div>

                        {/* TEXT */}

                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold leading-5 text-[#081A3A] transition-colors duration-300 group-hover:text-[#FF7A00]">
                            {property.title}
                          </h4>

                          <p className="mt-1 text-xs font-medium text-gray-500">
                            {property.size}
                          </p>
                        </div>

                        <FaArrowRight
                          className="
                            shrink-0
                            text-xs
                            text-[#FF7A00]
                            opacity-0
                            transition-all
                            duration-300

                            group-hover:translate-x-1
                            group-hover:opacity-100
                          "
                        />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </aside>
          </div>
        </div>
      </section>

      <CTASection />

      <Footer />

      {/* =====================================================
          POPUP FORM
      ===================================================== */}

      {/* Sold out property: enquiry popup intentionally disabled */}
    </>
  );
}