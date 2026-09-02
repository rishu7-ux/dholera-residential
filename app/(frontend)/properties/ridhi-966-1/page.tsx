"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import {
  FaArrowRight,
  FaBuilding,
  FaCheck,
  FaMapMarkerAlt,
  FaRoad,
  FaRulerCombined,
  FaStore,
} from "react-icons/fa";

import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import PopupForm from "@/components/PopupForm";


/* =========================================================
   DATA
========================================================= */

const whatAreScoPlots = [
  "Located in TP-4 (B2 Zone) — a strategically planned business sector",
  "Frontage on a 70-meter-wide road — enhancing visibility and accessibility",
  "Mixed-use zoning — shop or business space below, residential or office above",
  "Flexible development rights — ideal for diverse commercial ventures",
];

const primeLocation = [
  "Government-backed development",
  "Long-term structured urban planning",
  "Rapid infrastructure rollout",
  "Growth corridors for business and industry",
];

const scoStructure = [
  "Run retail shops on the ground floor",
  "Set up corporate offices above",
  "Build residential or service spaces on upper levels",
  "House clinics, showrooms, consulting firms, fine dining, and more",
];

const scoBenefits = [
  "Higher rental income potential",
  "Stronger resale value",
  "Broader business flexibility",
  "Long-term appreciation",
];

const roadAdvantages = [
  "Better customer access",
  "Visibility for storefronts and offices",
  "Increased traffic flow and footfall",
  "Enhanced long-term land value",
];

const plotDetails = [
  "Plot Sizes: Approximately 423 to 590 sq. yards",
  "Zoning: Mixed-use (Commercial + Residential)",
  "Road Connectivity: Planned network",
  "Ownership Type: Freehold",
];

const connectivity = [
  "Dholera Expressway links",
  "Proximity to upcoming Dholera International Airport",
  "Access to ABCD Administrative Zone",
  "Near industrial activation areas",
  "Integration under DMIC Corridor",
];

const investment2026 = [
  "Government-backed mega projects",
  "Industrial and commercial zone planning",
  "Infrastructure expansion underway",
  "Attractive early-stage pricing",
  "Increasing market awareness",
];

const buyerProfiles = [
  "Business owners planning retail shops",
  "Entrepreneurs seeking mixed-use ventures",
  "Long-term investors",
  "Commercial developers",
  "Professionals planning serviced offices or hospitality spaces",
];

const earlyInvestmentBenefits = [
  "Lower entry pricing",
  "Potential high future margins",
  "Strategic positioning before area densification",
  "Limited inventory advantage",
  "Premium commercial corridors along major roads",
];

const faqs = [
  {
    q: "What is the Ridhi 966/1 SCO Plot in Dholera?",
    a: "A mixed-use shop-cum-office plot located in TP-4 (B2 Zone) of Dholera Smart City.",
  },
  {
    q: "What plot sizes are available?",
    a: "Approximately 423 sq. yards to 590 sq. yards.",
  },
  {
    q: "Is the project inside Dholera SIR?",
    a: "Yes, it is located within the Dholera Special Investment Region.",
  },
  {
    q: "Can I build residential units on SCO plots?",
    a: "Yes, residential use is allowed on upper floors above commercial spaces.",
  },
  {
    q: "Is this a long-term investment?",
    a: "Yes, Dholera is a long-term infrastructure-driven growth opportunity.",
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
    image: "/images/249.png",
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
          <span className="h-0.5 w-8 bg-[#FF7A00]" />

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
                group-hover:bg-[#FF7A00]
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
              bg-[#FF7A00]
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
   PAGE
========================================================= */

export default function Page() {
  const [popupOpen, setPopupOpen] = useState(false);

  return (
    <>
      <TopBar />

      <Header />

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative overflow-hidden bg-[#FF7A00]">
        <div
          className="
            pointer-events-none
            absolute
            -right-20
            -top-32
            h-95
            w-95
            rotate-12
            border-55
            border-white/10
          "
        />

        <div
          className="
            relative
            mx-auto
            flex
            min-h-52.5
            max-w-7xl
            items-center
            px-5
            py-7
            sm:px-6
            lg:px-8
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
              duration: 0.65,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="max-w-4xl"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="h-0.5 w-10 bg-white" />

              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white sm:text-xs">
                Premium SCO Investment
              </span>
            </div>

            <h1
              className="
                text-3xl
                font-extrabold
                leading-[1.1]
                text-white
                sm:text-4xl
                lg:text-[42px]
              "
            >
              Ridhi 966/1

              <span className="mt-1 block">
                SCO Plots in Dholera Smart City
              </span>
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm font-medium text-white/90">
              <Link
                href="/"
                className="transition-colors duration-300 hover:text-[#081A3A]"
              >
                Home
              </Link>

              <span>/</span>

              <Link
                href="/properties"
                className="transition-colors duration-300 hover:text-[#081A3A]"
              >
                Properties
              </Link>

              <span>/</span>

              <span>Ridhi 966/1</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =====================================================
          MAIN IMAGE + PROPERTY CARD
      ===================================================== */}

      <section className="relative bg-white pb-28 md:pb-32">
        <div
          className="
            relative
            h-100
            w-full
            overflow-hidden
            sm:h-107.5
            md:h-125
            lg:h-140
          "
        >
          <Image
            src="/images/ridhi-966-1.png"
            alt="Ridhi 966/1 SCO Plots Dholera"
            fill
            priority
            sizes="100vw"
            className="
              scale-[1.03]
              object-cover
            "
          />

          <div className="absolute inset-0 bg-[#081A3A]/12" />

          <div
            className="
              absolute
              inset-x-0
              bottom-0
              h-40
              bg-linear-to-t
              from-[#081A3A]/30
              to-transparent
            "
          />
        </div>

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
            className="
              overflow-hidden
              rounded-[28px]
              border
              border-[#FF7A00]/15
              bg-white
              shadow-[0_30px_80px_rgba(8,26,58,0.18)]
            "
          >
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
              <div>
                <div className="flex items-center gap-2 text-[#FF7A00]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF0E2] sm:h-8 sm:w-8">
                    <FaMapMarkerAlt className="text-[10px] sm:text-xs" />
                  </span>

                  <span className="text-xs font-bold sm:text-sm">
                    Bhangadh Dholera
                  </span>
                </div>

                <h2 className="mt-2.5 text-[20px] font-extrabold leading-[1.2] text-[#081A3A] sm:mt-4 sm:text-3xl md:text-[34px]">
                  Ridhi 966/1 SCO Plots
                </h2>
              </div>

              <motion.div
                whileHover={{ y: -3 }}
                className="shrink-0 rounded-2xl border border-[#C94F00]/20 bg-[#FFF0E6] px-4 py-3 shadow-[0_8px_24px_rgba(201,79,0,0.10)] sm:px-6 sm:py-4 lg:text-right"
              >
                <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#9A5A35] sm:text-[10px]">
                  Availability
                </p>
                <p className="mt-1 text-[22px] font-black leading-none text-[#C94F00] sm:text-2xl md:text-3xl">
                  AVAILABLE
                </p>
                <p className="mt-1.5 text-[10px] font-semibold text-[#8B6B58] sm:text-xs">
                  Contact us for latest inventory
                </p>
              </motion.div>
            </div>

            <div className="mx-4 h-px bg-gray-100 sm:mx-6 md:mx-8 lg:mx-10" />

            <div className="px-4 pb-1 pt-0 sm:px-6 sm:py-6 md:px-8 lg:px-10">
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
                  sm:rounded-none
                  sm:border-0
                  sm:bg-transparent
                  lg:grid-cols-4
                "
              >
                {[
                  {
                    icon: <FaRulerCombined />,
                    title: "Total Area",
                    value: "17,492 Sq. Yd.",
                  },
                  {
                    icon: <FaStore />,
                    title: "Plot Sizes",
                    value: "423 - 590 Sq. Yd.",
                  },
                  {
                    icon: <FaRoad />,
                    title: "FP Road",
                    value: "70 Mtr",
                  },
                  {
                    icon: <FaBuilding />,
                    title: "TP Scheme",
                    value: "TP 4, 4B-2",
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
                      sm:border-[#FF7A00]/10
                      sm:p-4
                      sm:hover:border-[#FF7A00]/30
                      sm:hover:shadow-[0_10px_25px_rgba(255,122,0,0.10)]

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
                          ? "border-r border-[#FF7A00]/15 sm:border"
                          : ""
                      }

                      ${
                        index === 3
                          ? "border-[#FF7A00]/15 sm:border"
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
                <span className="whitespace-nowrap">
                  Enquire Now
                </span>

                <FaArrowRight className="text-[8px] transition-transform duration-300 group-hover:translate-x-1 sm:text-xs" />
              </motion.button>

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
            <main>
              <section>
                <SectionHeading
                  small="Premium Investment"
                  title="Ridhi 966/1 SCO Plots in Dholera Smart City — A Premium Mixed-Use Investment Opportunity"
                />

                <motion.p
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="text-lg font-medium leading-9 text-gray-700"
                >
                  Prime commercial land in India&apos;s fastest-emerging smart
                  city doesn&apos;t come often—and Ridhi 966/1 SCO plots in
                  Dholera Smart City are exactly the kind of opportunity that
                  investors, business owners, and developers have been waiting
                  for.
                </motion.p>

                <motion.p
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="mt-6 text-lg font-medium leading-9 text-gray-700"
                >
                  Located in Dholera SIR&apos;s TP-4 (B2 Zone), this project
                  stands out not just for its strategic positioning but also
                  for its flexible mixed-use potential. Whether you&apos;re
                  planning a retail business, office space, or a combined
                  commercial-residential venture, Ridhi 966/1 is designed to
                  support growth, visibility, and long-term value.
                </motion.p>
              </section>

              <section className="mt-16">
                <SectionHeading
                  small="Project Overview"
                  title="What Are Ridhi 966/1 SCO Plots in Dholera?"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  Ridhi 966/1 SCO plots are Shop-Cum-Office (SCO) plots —
                  mixed-use land parcels that allow a combination of commercial
                  and residential usage. These plots sit within Dholera Smart
                  City, India&apos;s first planned greenfield smart industrial
                  city under the Dholera Special Investment Region (SIR).
                </p>

                <BulletCards items={whatAreScoPlots} />
              </section>

              <section className="mt-16">
                <SectionHeading
                  small="Investment Advantage"
                  title="Why Invest in Ridhi 966/1 SCO Plots?"
                />

                <h3 className="text-2xl font-extrabold text-[#FF7A00]">
                  Prime Location Inside Dholera SIR
                </h3>

                <p className="mt-4 text-lg font-medium leading-9 text-gray-700">
                  Being inside the Dholera Special Investment Region places this
                  project at the core of India&apos;s planned industrial
                  expansion, including the Delhi-Mumbai Industrial Corridor
                  (DMIC).
                </p>

                <BulletCards items={primeLocation} />
              </section>

              <section className="mt-16">
                <SectionHeading
                  small="Commercial Flexibility"
                  title="Understanding SCO Plots & Their Profitability"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  A Shop-Cum-Office (SCO) structure allows you to:
                </p>

                <BulletCards items={scoStructure} />

                <h3 className="mt-10 text-2xl font-extrabold text-[#081A3A]">
                  Benefits Include
                </h3>

                <BulletCards items={scoBenefits} />
              </section>

              <section className="mt-16">
                <SectionHeading
                  small="Connectivity"
                  title="The Advantage of a 70-Meter Wide Road"
                />

                <BulletCards items={roadAdvantages} />
              </section>

              <section className="mt-16">
                <SectionHeading
                  small="Property Details"
                  title="Plot Sizes & Ownership Details"
                />

                <BulletCards items={plotDetails} />
              </section>

              <section className="mt-16">
                <SectionHeading
                  small="Infrastructure"
                  title="Connectivity & Infrastructure"
                />

                <BulletCards items={connectivity} />
              </section>

              <section className="mt-16">
                <SectionHeading
                  small="Investment"
                  title="Is Dholera a Good Investment in 2026?"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  Yes—especially for long-term investors. Dholera is a
                  government-planned smart city with phased development
                  milestones and large-scale infrastructure growth.
                </p>

                <BulletCards items={investment2026} />

                <motion.div
                  initial={{
                    opacity: 0,
                    y: 20,
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                  }}
                  viewport={{
                    once: true,
                  }}
                  whileHover={{
                    y: -4,
                  }}
                  className="
                    mt-8
                    rounded-2xl
                    border
                    border-[#FF7A00]/15
                    bg-[#FFF4E8]
                    p-6
                    shadow-[0_10px_30px_rgba(255,122,0,0.08)]
                  "
                >
                  <p className="text-lg font-bold leading-8 text-[#081A3A]">
                    This is a long-term land banking opportunity with a 5–10+
                    year horizon.
                  </p>
                </motion.div>
              </section>

              <section className="mt-16">
                <SectionHeading
                  small="Buyer Profile"
                  title="Who Should Consider Buying?"
                />

                <BulletCards items={buyerProfiles} />
              </section>

              <section className="mt-16">
                <SectionHeading
                  small="Early Advantage"
                  title="Benefits of Investing Early in TP-4 Zone"
                />

                <BulletCards items={earlyInvestmentBenefits} />
              </section>

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

              <section className="mt-16">
                <SectionHeading
                  small="Conclusion"
                  title="Final Thoughts"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  Ridhi 966/1 SCO plots represent an early-stage opportunity in
                  one of India&apos;s most ambitious smart city developments.
                  With wide-road connectivity, flexible mixed-use zoning, and
                  integration under the DMIC corridor, these plots offer strong
                  capital appreciation potential along with operational income
                  opportunities.
                </p>
              </section>

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
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7A00]">
                  Project Brochure
                </span>

                <h2 className="mt-3 text-3xl font-extrabold text-[#081A3A]">
                  Download Ridhi 966/1 Brochure
                </h2>

                <p className="mt-4 text-lg leading-8 text-gray-700">
                  View complete project information, location details and
                  investment information.
                </p>

                <motion.a
                  href="/brochures/Ridhi9661.pdf"
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
                <span className="absolute left-0 top-0 h-1 w-full bg-[#FF7A00]" />

                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7A00]">
                  Property Enquiry
                </span>

                <h3 className="mt-2 text-3xl font-extrabold text-[#081A3A]">
                  Interested in Ridhi 966/1?
                </h3>

                <p className="mt-3 text-sm leading-6 text-gray-600">
                  Speak with our property team for pricing, availability and
                  site visit information.
                </p>

                <motion.button
                  type="button"
                  onClick={() => setPopupOpen(true)}
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
                  Enquire Now

                  <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-2" />
                </motion.button>
              </motion.div>

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
                  rounded-[26px]
                  border
                  border-gray-100
                  bg-white
                  p-6
                  shadow-[0_15px_45px_rgba(8,26,58,0.07)]
                "
              >
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7A00]">
                  Explore More
                </span>

                <h3 className="mt-2 text-2xl font-extrabold text-[#081A3A]">
                  Recent Properties
                </h3>

                <span className="mt-3 block h-0.75 w-10 rounded-full bg-[#FF7A00]" />

                <div className="mt-6 space-y-3">
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
                          flex
                          items-center
                          gap-3
                          rounded-xl
                          border
                          border-transparent
                          p-2.5
                          transition-all
                          duration-300
                          hover:translate-x-1
                          hover:border-[#FF7A00]/15
                          hover:bg-[#FFF4E8]
                        "
                      >
                        <div className="relative h-17 w-21 shrink-0 overflow-hidden rounded-xl">
                          <Image
                            src={property.image}
                            alt={property.title}
                            fill
                            sizes="84px"
                            className="
                              object-cover
                              transition-transform
                              duration-700
                              group-hover:scale-110
                            "
                          />
                        </div>

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

      <PopupForm
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        propertyName="Ridhi 966/1 SCO Plots"
      />
    </>
  );
}
