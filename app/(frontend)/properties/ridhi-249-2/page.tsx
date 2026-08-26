"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import {
  FaArrowRight,
  FaBuilding,
  FaCheck,
  FaFileAlt,
  FaMapMarkerAlt,
  FaRoad,
  FaRulerCombined,
  FaShieldAlt,
  FaStore,
} from "react-icons/fa";

import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";

/* =========================================================
   PROJECT DATA
========================================================= */

const projectSnapshot = [
  ["Project Name", "Ridhi 249/2"],
  ["Location", "Kadipur Village, Dholera SIR, Gujarat"],
  ["TP Scheme", "TP-1"],
  ["Land Type", "SCO (Shop-Cum-Office)"],
  ["Land Use Permission", "Mixed Use (Commercial + Office + Retail)"],
  ["Legal Status", "NA Converted"],
  ["Road Width", "55 Metres"],
  ["Total Area", "5,688 Sq. Yards"],
  ["Available Plot Sizes", "390 | 578 | 687 Sq. Yards"],
  ["Price", "₹20,500 per Sq. Yard"],
  ["Starting From", "₹80,00,000 (390 sq. yd.)"],
  ["Status", "SOLD OUT"],
];

const priceBreakdown = [
  [
    "390 sq. yd.",
    "₹20,500",
    "₹80,00,000",
    "Small business / investor entry",
  ],
  [
    "578 sq. yd.",
    "₹20,500",
    "₹1.19 Crore+",
    "Mid-size retail / office",
  ],
  [
    "687 sq. yd.",
    "₹20,500",
    "₹1.41 Crore+",
    "Large format / corner showroom",
  ],
];

const standoutFactors = [
  "Location inside TP-1 — the zone directly adjacent to Dholera's Activation Area.",
  "NA conversion already in place — legally ready for permitted mixed-use development.",
  "55-metre wide TP road frontage — strong commercial visibility and accessibility.",
  "Mixed-use land permission — retail, office, hospitality, healthcare, education and more.",
];

const kadipurValue = [
  "Kadipur is among the important inside-SIR villages for commercial and technology-led development.",
  "Planned metro connectivity under Ahmedabad-Dholera MRTS.",
  "Strong IT park and startup ecosystem potential because of TP-1 positioning.",
  "Close to ABCD Building — the administrative and business hub of Dholera SIR.",
  "Direct access to 55-metre wide TP road.",
];

const scoGroundFloor = [
  "Pharmacies, banks, convenience stores, cafes, clinics, telecom outlets and insurance offices.",
];

const scoUpperFloors = [
  "Corporate offices, co-working spaces, IT firms and consultancy agencies.",
  "Government offices and training centres.",
  "Flexible upper-floor commercial development opportunities.",
];

const mixedUsePoints = [
  "Retail + Office + Residential + Hospitality + Healthcare in one project.",
  "Multiple potential revenue streams.",
  "Lower dependency on a single property use.",
  "Suitable for planned smart-city development.",
];

const buildoutLevels = [
  "Ground floor retail shops",
  "2nd–3rd floor office spaces",
  "4th–5th floor hotel or serviced apartments",
  "Top floors residential units",
];

const dsirdaPoints = [
  "Development must conform to the sanctioned TP-1 scheme.",
  "Infrastructure surrounding the project follows the Dholera development framework.",
  "Road network and land-use development must follow applicable planning regulations.",
  "Buyers should independently verify all applicable approvals and documents.",
];

const documentsToVerify = [
  "7/12 Extract (Satbara Utara)",
  "NA Conversion Order",
  "DSIRDA / TP-1 Scheme Confirmation",
  "Encumbrance Certificate",
  "Complete Title Chain",
  "Additional NOCs applicable to the location",
];

const buyerProfiles = [
  {
    title: "Commercial Investors",
    text:
      "Suitable for investors considering future rental demand from retail, office, service and mixed-use development within Dholera's commercial growth corridors.",
  },
  {
    title: "Portfolio Investors",
    text:
      "Investors with a medium-to-long-term horizon may consider TP-1 land where value is connected with infrastructure and surrounding commercial development.",
  },
  {
    title: "Business Owners",
    text:
      "Retailers, healthcare providers, professional firms and hospitality businesses can evaluate owning commercial land for their future operations.",
  },
  {
    title: "NRI Investors",
    text:
      "NRIs and outstation buyers can evaluate the project remotely, subject to applicable legal, banking and regulatory requirements.",
  },
];

const infraDrivers = [
  {
    title: "Dholera Industrial Development",
    text:
      "Large industrial and manufacturing investments can create future demand for commercial, residential and service infrastructure.",
  },
  {
    title: "Dholera International Airport",
    text:
      "Airport development is one of the important connectivity drivers for the Dholera region.",
  },
  {
    title: "Ahmedabad–Dholera Expressway",
    text:
      "Expressway connectivity improves accessibility between Ahmedabad and Dholera.",
  },
  {
    title: "Planned Mass Transit Connectivity",
    text:
      "Future transit planning can strengthen connectivity between Dholera and surrounding urban centres.",
  },
  {
    title: "Government Infrastructure Investment",
    text:
      "Continued infrastructure investment remains important for Dholera SIR's long-term development.",
  },
];

const faqs = [
  {
    q: "What is Ridhi 249/2 in Dholera SIR?",
    a:
      "Ridhi 249/2 is an SCO mixed-use plot development in Kadipur Village, within TP-1 of Dholera SIR. It offers 390, 578 and 687 sq. yard plot options.",
  },
  {
    q: "What is the price of plots in Ridhi 249/2?",
    a:
      "The supplied project data lists ₹20,500 per sq. yard, with the 390 sq. yard option starting around ₹80 lakh. Confirm current pricing with the sales team.",
  },
  {
    q: "Where is Ridhi 249/2 located?",
    a:
      "The project is located in Kadipur Village, within TP Scheme-1 of Dholera SIR.",
  },
  {
    q: "Is Ridhi 249/2 NA converted?",
    a:
      "The supplied project information describes the land as NA converted. Buyers should independently verify the original NA order and title documents.",
  },
  {
    q: "What does mixed-use permission mean?",
    a:
      "Mixed-use permission can allow a combination of commercial, office, retail and other permitted uses, subject to applicable development regulations.",
  },
  {
    q: "Can NRIs invest?",
    a:
      "NRIs may be able to invest subject to applicable FEMA, banking and property regulations. Independent legal advice is recommended.",
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
   TABLE
========================================================= */

function DataTable({
  rows,
  headers,
}: {
  rows: string[][];
  headers?: string[];
}) {
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
      viewport={{ once: true }}
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
          {headers && (
            <thead>
              <tr className="bg-[#FF7A00] text-white">
                {headers.map((header, index) => (
                  <th
                    key={index}
                    className="px-5 py-4 text-sm font-bold"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
          )}

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
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`
                      px-5
                      py-4
                      text-sm
                      leading-6
                      md:text-[15px]

                      ${
                        cellIndex === 0
                          ? "font-bold text-[#081A3A]"
                          : "font-medium text-gray-700"
                      }
                    `}
                  >
                    {cell}
                  </td>
                ))}
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
  return (
    <>
      <TopBar />

      <Header />

      {/* =====================================================
          SMALL ORANGE HERO
      ===================================================== */}
      <section className="relative overflow-hidden bg-[#FF7A00]">
        {/* DECORATION */}
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
            {/* SOLD OUT STATUS */}
            <div className="mb-4">
              <span className="inline-flex items-center rounded-full border border-white/30 bg-[#C94F00] px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white shadow-[0_8px_24px_rgba(110,40,0,0.22)] sm:text-xs">
                Sold Out
              </span>
            </div>

            {/* LABEL */}
            <div className="mb-4 flex items-center gap-3">
              <span className="h-0.5 w-10 bg-white" />

              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white sm:text-xs">
                Premium SCO Investment
              </span>
            </div>

            {/* TITLE */}
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
              Ridhi 249/2

              <span className="mt-1 block">
                Premium SCO Plots in Kadipur
              </span>
            </h1>

            {/* BREADCRUMB */}
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

              <span>Ridhi 249/2</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =====================================================
          SINGLE BACKGROUND IMAGE
      ===================================================== */}
      <section className="relative bg-white pb-28 md:pb-32">
        {/* =================================================
            ONE CLEAN BACKGROUND IMAGE
        ================================================= */}
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
            src="/images/249.png"
            alt="Ridhi 249/2 Premium SCO Plots - Sold Out"
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

          {/* SOLD OUT BLUR / DARK OVERLAY */}
          <div
            className="
              absolute
              inset-0
              bg-[#081A3A]/22
              backdrop-blur-[1px]
            "
          />

          {/* BOTTOM GRADIENT */}
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

          {/* SOLD OUT IMAGE OVERLAY */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="-rotate-12 border-y-4 border-white/80 bg-[#C94F00]/95 px-10 py-3 text-center text-2xl font-black uppercase tracking-[0.22em] text-white shadow-[0_12px_35px_rgba(74,24,0,0.30)] backdrop-blur-[2px] sm:px-14 sm:py-4 sm:text-4xl md:text-5xl">
              Sold Out
            </div>
          </div>
        </div>

        {/* =================================================
            PROPERTY CARD AT BOTTOM
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
            className="
              overflow-hidden
              rounded-[28px]
              border
              border-[#FF7A00]/15
              bg-white
              shadow-[0_30px_80px_rgba(8,26,58,0.18)]
            "
          >
            {/* =========================================
                TITLE + PRICE
            ========================================= */}
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
                    Kadipur Village, Dholera SIR
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
                  Ridhi 249/2 Premium SCO Plots
                </h2>
              </div>

              {/* SOLD OUT STATUS */}
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

            {/* =========================================
                PROPERTY DETAILS
                SAME COMPACT STYLE AS RIDHI 872
            ========================================= */}
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
                  sm:rounded-none
                  sm:border-0
                  sm:bg-transparent

                  lg:grid-cols-5
                "
              >
                {[
                  {
                    icon: <FaBuilding />,
                    title: "Survey",
                    value: "249/2",
                  },
                  {
                    icon: <FaRulerCombined />,
                    title: "Total Area",
                    value: "5,688 Sq. Yd.",
                  },
                  {
                    icon: <FaStore />,
                    title: "Plot Sizes",
                    value: "390 | 578 | 687",
                  },
                  {
                    icon: <FaRoad />,
                    title: "Road",
                    value: "55 Metres",
                  },
                  {
                    icon: <FaMapMarkerAlt />,
                    title: "TP Scheme",
                    value: "TP-1",
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
                    {/* ICON */}
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

                    {/* TEXT */}
                    <div className="ml-1.5 min-w-0 sm:ml-0">
                      {/* LABEL */}
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

                      {/* VALUE */}
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

            {/* =========================================
                BUTTONS
            ========================================= */}
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
              {/* SOLD OUT BUTTON */}
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="flex h-10 flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-[#C94F00]/15 bg-[#C94F00] px-2 text-[11px] font-black uppercase tracking-[0.08em] text-white shadow-[0_6px_18px_rgba(201,79,0,0.18)] opacity-95 sm:h-auto sm:flex-none sm:rounded-xl sm:px-5 sm:py-3 sm:text-[13px]"
              >
                <span className="whitespace-nowrap">Sold Out</span>
              </button>

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
                LEFT CONTENT
            ================================================= */}
            <main>
              {/* SOLD OUT NOTICE */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mb-8 overflow-hidden rounded-[22px] border border-[#C94F00]/15 bg-[#FFF0E6] shadow-[0_12px_35px_rgba(201,79,0,0.08)]"
              >
                <div className="flex items-start gap-4 p-5 sm:p-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#C94F00] text-sm font-black text-white">✓</span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C94F00]">Property Status</p>
                    <h2 className="mt-1 text-xl font-extrabold text-[#081A3A] sm:text-2xl">Ridhi 249/2 is currently sold out</h2>
                    <p className="mt-2 text-sm leading-7 text-gray-600">All currently listed inventory for this property has been sold. You can still review the project information below or explore other available properties.</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <p className="text-lg font-medium leading-9 text-gray-700">
                  There are moments in real estate where the right location,
                  land type and timing all converge. In India&apos;s emerging
                  smart-city landscape, that convergence has a name: Ridhi
                  249/2, Kadipur, Dholera SIR.
                </p>

                <p className="mt-6 text-lg font-medium leading-9 text-gray-700">
                  If you have been researching SCO plots or commercial land for
                  sale in Dholera Smart City, this page gives you the complete
                  project picture — location, TP-1 context, pricing, legal
                  considerations and buyer suitability.
                </p>
              </motion.div>

              {/* PROJECT */}
              <section className="mt-16">
                <SectionHeading
                  small="Project Overview"
                  title="Ridhi 249/2 — Complete Project Specifications"
                />

                <DataTable
                  rows={projectSnapshot}
                  headers={[
                    "Project at a Glance",
                    "Ridhi 249/2 — Kadipur, TP-1",
                  ]}
                />
              </section>

              {/* ADVANTAGES */}
              <section className="mt-16">
                <SectionHeading
                  small="Project Advantage"
                  title="What Makes Ridhi 249/2 Stand Out?"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  Ridhi 249/2 is a mixed-use SCO development covering
                  approximately 5,688 sq. yards in Kadipur Village within
                  Dholera SIR&apos;s TP-1.
                </p>

                <BulletCards items={standoutFactors} />
              </section>

              {/* LOCATION */}
              <section className="mt-16">
                <SectionHeading
                  small="Location"
                  title="Why Kadipur in TP-1 Matters"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  Location inside Dholera SIR is closely connected to the Town
                  Planning scheme, road network, permitted land use and
                  surrounding infrastructure.
                </p>

                <BulletCards items={kadipurValue} />
              </section>

              {/* SCO */}
              <section className="mt-16">
                <SectionHeading
                  small="Commercial Flexibility"
                  title="SCO Plot Development Potential"
                />

                <p className="text-lg font-medium leading-9 text-gray-700">
                  SCO plots can support combinations of retail and upper-floor
                  business use subject to applicable planning and development
                  regulations.
                </p>

                <BulletCards items={scoGroundFloor} />

                <div className="mt-5">
                  <BulletCards items={scoUpperFloors} />
                </div>
              </section>

              {/* MIXED USE */}
              <section className="mt-16">
                <SectionHeading
                  small="Mixed Use"
                  title="Mixed-Use Development Possibilities"
                />

                <BulletCards items={mixedUsePoints} />

                <div className="mt-5">
                  <BulletCards items={buildoutLevels} />
                </div>
              </section>

              {/* PRICING */}
              <section className="mt-16">
                <SectionHeading
                  small="Pricing"
                  title="Plot Size & Pricing Breakdown"
                />

                <DataTable
                  rows={priceBreakdown}
                  headers={[
                    "Plot Size",
                    "Rate",
                    "Total Price",
                    "Best For",
                  ]}
                />

                <div className="mt-6 rounded-2xl border border-[#FF7A00]/15 bg-[#FFF4E8] p-5">
                  <p className="font-semibold leading-7 text-[#081A3A]">
                    Pricing and inventory may change. Contact the sales team for
                    current availability and confirmed pricing.
                  </p>
                </div>
              </section>

              {/* LEGAL */}
              <section className="mt-16">
                <SectionHeading
                  small="Documentation"
                  title="Legal Framework & Documents to Verify"
                />

                <BulletCards items={dsirdaPoints} />

                <div className="mt-10 flex items-center gap-3">
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

                  <h3 className="text-2xl font-extrabold text-[#081A3A]">
                    Documents to Verify
                  </h3>
                </div>

                <BulletCards items={documentsToVerify} />
              </section>

              {/* BUYER PROFILE */}
              <section className="mt-16">
                <SectionHeading
                  small="Investor Profiles"
                  title="Who Should Consider Ridhi 249/2?"
                />

                <div className="grid gap-5 md:grid-cols-2">
                  {buyerProfiles.map((buyer, index) => (
                    <motion.article
                      key={buyer.title}
                      initial={{
                        opacity: 0,
                        y: 30,
                      }}
                      whileInView={{
                        opacity: 1,
                        y: 0,
                      }}
                      viewport={{ once: true }}
                      transition={{
                        delay: index * 0.07,
                        duration: 0.5,
                      }}
                      whileHover={{
                        y: -7,
                      }}
                      className="
                        group
                        rounded-3xl
                        border
                        border-[#FF7A00]/10
                        bg-white
                        p-6
                        shadow-[0_12px_40px_rgba(8,26,58,0.07)]
                        transition-all
                        duration-300

                        hover:border-[#FF7A00]/30
                        hover:bg-[#FFF7EF]
                        hover:shadow-[0_20px_50px_rgba(255,122,0,0.12)]
                      "
                    >
                      <span
                        className="
                          flex
                          h-12
                          w-12
                          items-center
                          justify-center
                          rounded-2xl
                          bg-[#FFF0E2]
                          text-[#FF7A00]
                          transition-all
                          duration-300

                          group-hover:scale-110
                          group-hover:bg-[#FF7A00]
                          group-hover:text-white
                        "
                      >
                        <FaBuilding />
                      </span>

                      <h3 className="mt-5 text-xl font-extrabold text-[#081A3A]">
                        {buyer.title}
                      </h3>

                      <p className="mt-4 leading-7 text-gray-600">
                        {buyer.text}
                      </p>
                    </motion.article>
                  ))}
                </div>
              </section>

              {/* INFRASTRUCTURE */}
              <section className="mt-16">
                <SectionHeading
                  small="Growth Drivers"
                  title="Infrastructure Supporting Dholera Growth"
                />

                <div className="space-y-4">
                  {infraDrivers.map((driver, index) => (
                    <motion.article
                      key={driver.title}
                      initial={{
                        opacity: 0,
                        x: index % 2 === 0 ? -25 : 25,
                      }}
                      whileInView={{
                        opacity: 1,
                        x: 0,
                      }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.5,
                      }}
                      whileHover={{
                        x: 5,
                      }}
                      className="
                        group
                        flex
                        gap-4
                        rounded-2xl
                        border
                        border-gray-100
                        bg-white
                        p-5
                        shadow-[0_8px_30px_rgba(8,26,58,0.05)]
                        transition-all
                        duration-300

                        hover:border-[#FF7A00]/25
                        hover:bg-[#FFF7EF]
                      "
                    >
                      <span
                        className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-[#FFF0E2]
                          font-extrabold
                          text-[#FF7A00]
                        "
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <div>
                        <h3 className="text-lg font-extrabold text-[#081A3A] transition-colors duration-300 group-hover:text-[#FF7A00]">
                          {driver.title}
                        </h3>

                        <p className="mt-2 leading-7 text-gray-600">
                          {driver.text}
                        </p>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </section>

              {/* FAQ */}
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
                      viewport={{ once: true }}
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

              {/* FINAL CTA */}
              <motion.section
                initial={{
                  opacity: 0,
                  y: 30,
                }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                }}
                viewport={{ once: true }}
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
                  Ridhi 249/2 is Sold Out
                </h2>

                <p className="mt-4 text-lg leading-8 text-gray-700">
                  This property is no longer available. Explore our other current
                  property opportunities in Dholera.
                </p>

                <Link
                  href="/properties"
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

                    hover:-translate-y-1
                    hover:bg-[#FF9638]
                    hover:shadow-[0_15px_30px_rgba(255,122,0,0.28)]
                  "
                >
                  Explore Available Properties

                  <FaArrowRight />
                </Link>
              </motion.section>
            </main>

            {/* =================================================
                RIGHT SIDEBAR
            ================================================= */}
            <aside className="space-y-7 self-start lg:sticky lg:top-28">
              {/* SOLD OUT SIDEBAR */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="relative overflow-hidden rounded-[26px] border border-[#C94F00]/15 bg-[#FFF0E6] p-6 shadow-[0_20px_55px_rgba(201,79,0,0.12)]"
              >
                <span className="absolute left-0 top-0 h-[4px] w-full bg-[#C94F00]" />
                <span className="text-xs font-black uppercase tracking-[0.18em] text-[#C94F00]">Property Status</span>
                <h3 className="mt-2 text-3xl font-extrabold text-[#081A3A]">Sold Out</h3>
                <p className="mt-3 text-sm leading-7 text-gray-600">Ridhi 249/2 currently has no available inventory. Browse other active property opportunities or contact our team for alternatives.</p>
                <Link href="/properties" className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-[#FF7A00] py-4 font-bold text-white shadow-[0_10px_25px_rgba(255,122,0,0.22)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#FF9638]">
                  Explore Available Properties
                  <FaArrowRight />
                </Link>
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
                viewport={{ once: true }}
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
                      viewport={{ once: true }}
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

      {/* Property sold out: enquiry popup intentionally not shown */}
    </>
  );
}
