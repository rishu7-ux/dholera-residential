"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import {
  FaArrowRight,
  FaMapMarkerAlt,
  FaBuilding,
  FaRoad,
} from "react-icons/fa";

import PopupForm from "./PopupForm";

/* =========================================================
   PROPERTY DATA
========================================================= */

const properties = [
  {
    id: 1,
    title: "Samridhi 621 Panchi",
    image: "/images/WhatsApp Image 2026-08-12 at 4.58.35 PM (1).jpeg",
    price: "₹72,00,000",
    details: [
      "Panchi Village",
      "TP4 (TP-4/B2)",
      "Near City Centre, Ahmedabad-Dholera Expressway & HAC",
    ],
    slug: "samridhi-621-panchi",
  },

  {
    id: 2,
    title: "Samridhi 872/2",
    image: "/images/Sidhi-857.jpg",
    price: "₹1,35,00,000",
    details: [
      "Sandida Village",
      "TP4 (TP-4/B2)",
      "70 M Road • Metro Connected • 4.5 KM Activation Zone",
    ],
    slug: "samridhi-872-2",
  },

  {
    id: 3,
    title: "Samridhi 365 Industrial",
    image: "/images/simridhi365industrial.webp",
    price: "₹63,00,000",
    details: [
      "Sandida Village",
      "TP-4/B1",
      "Near Activation Zone, HAC on 18 M Road, Both Side L-Shape Plot",
    ],
    slug: "samridhi-365-industrial",
  },
];

/* =========================================================
   CARD ANIMATION
========================================================= */

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 55,
    scale: 0.96,
  },

  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,

    transition: {
      delay: index * 0.12,
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

/* =========================================================
   COMPONENT
========================================================= */

export default function RecentProperties() {
  const [popupOpen, setPopupOpen] = useState(false);

  const [selectedProperty, setSelectedProperty] =
    useState("");

  const handleEnquiryClick = (title: string) => {
    setSelectedProperty(title);
    setPopupOpen(true);
  };

  return (
    <section
      className="
        relative
        overflow-hidden
        bg-[#FAFAFA]
        py-10
        sm:py-14
        md:py-18
      "
    >
      {/* =====================================================
          SOFT BACKGROUND EFFECT
      ===================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          -left-36
          top-20
          h-80
          w-80
          rounded-full
          bg-[#FF7A00]/5
          blur-3xl
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -right-36
          bottom-0
          h-80
          w-80
          rounded-full
          bg-[#FF7A00]/5
          blur-3xl
        "
      />

      <div
        className="
          relative
          mx-auto
          max-w-7xl
          px-5
          sm:px-6
          lg:px-8
        "
      >
        {/* =====================================================
            SECTION HEADER
        ===================================================== */}

        <motion.div
          initial={{
            opacity: 0,
            y: 35,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{
            once: true,
            amount: 0.3,
          }}
          transition={{
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mb-6 max-w-4xl sm:mb-8 md:mb-10"
        >
          {/* SMALL LABEL */}

          <motion.div
            initial={{
              opacity: 0,
              x: -25,
            }}
            whileInView={{
              opacity: 1,
              x: 0,
            }}
            viewport={{
              once: true,
            }}
            transition={{
              duration: 0.5,
            }}
            className="
              mb-4
              flex
              items-center
              gap-3
            "
          >
            <motion.span
              initial={{
                width: 0,
              }}
              whileInView={{
                width: 42,
              }}
              viewport={{
                once: true,
              }}
              transition={{
                duration: 0.6,
                delay: 0.15,
              }}
              className="
                h-0.5
                rounded-full
                bg-[#FF7A00]
              "
            />

            <span
              className="
                text-xs
                font-bold
                uppercase
                tracking-[0.2em]
                text-[#FF7A00]
              "
            >
              Recent Properties
            </span>
          </motion.div>

          {/* HEADING */}

          <h2
            className="
              text-3xl
              font-extrabold
              leading-tight
              tracking-tight
              text-[#081A3A]

              sm:text-4xl
              md:text-5xl
            "
          >
            Our Recent Dholera{" "}

            <span className="text-[#FF7A00]">
              Property
            </span>
          </h2>

          {/* DESCRIPTION */}

          <p
            className="
              mt-5
              max-w-2xl
              text-base
              leading-8
              text-gray-600

              sm:text-lg
            "
          >
            Explore premium SCO, Residential &amp;
            Industrial plots in Dholera Smart City.
          </p>

          {/* ANIMATED LINE */}

          <motion.div
            animate={{
              width: [48, 95, 48],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="
              mt-6
              h-0.75
              rounded-full
              bg-[#FF7A00]
            "
          />
        </motion.div>

        {/* =====================================================
            PROPERTY GRID
        ===================================================== */}

        <div
          className="
            grid
            gap-3

            sm:gap-4

            md:grid-cols-2

            xl:grid-cols-3
            xl:gap-7
          "
        >
          {properties.map((item, index) => (
            <motion.article
              key={item.id}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{
                once: true,
                amount: 0.15,
              }}
              whileHover={{
                y: -9,
              }}
              className="
                group
                relative
                overflow-hidden
                rounded-[18px]
                border
                border-[#FF7A00]/10
                bg-white
                shadow-[0_15px_45px_rgba(8,26,58,0.08)]
                transition-all
                duration-500

                hover:border-[#FF7A00]/25
                hover:shadow-[0_25px_65px_rgba(255,122,0,0.14)]
              "
            >
              {/* TOP ORANGE LINE */}

              <span
                className="
                  absolute
                  left-0
                  top-0
                  z-30
                  h-1
                  w-0
                  bg-[#FF7A00]
                  transition-all
                  duration-700

                  group-hover:w-full
                "
              />

              {/* =================================================
                  IMAGE
              ================================================= */}

              <div
                className="
                  relative
                  h-45
                  overflow-hidden

                  sm:h-57.5
                  md:h-67.5
                  lg:h-75
                "
              >
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="
                    (max-width: 768px) 100vw,
                    (max-width: 1280px) 50vw,
                    33vw
                  "
                  className="
                    object-cover
                    transition-transform
                    duration-1100
                    ease-[cubic-bezier(0.22,1,0.36,1)]

                    group-hover:scale-110
                  "
                />

                {/* OVERLAY */}

                <div
                  className="
                    absolute
                    inset-0
                    bg-linear-to-t
                    from-[#081A3A]/60
                    via-transparent
                    to-transparent
                  "
                />

                {/* =================================================
                    PRICE TAG
                ================================================= */}

                <motion.div
                  initial={{
                    opacity: 0,
                    y: -12,
                    scale: 0.96,
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  viewport={{
                    once: true,
                  }}
                  transition={{
                    delay: 0.22 + index * 0.08,
                    duration: 0.45,
                  }}
                  whileHover={{
                    scale: 1.04,
                  }}
                  className="
                    absolute
                    left-2.5
                    top-2.5

                    sm:left-4
                    sm:top-4
                    z-20
                    rounded-xl
                    border
                    border-white/20
                    bg-[#FF7A00]
                    px-2.5
                    py-1.5

                    sm:px-4
                    sm:py-2.5
                    shadow-[0_9px_22px_rgba(255,122,0,0.30)]
                  "
                >
                  <p
                    className="
                      text-[7px]
                      font-bold

                      sm:text-[9px]
                      uppercase
                      tracking-[0.15em]
                      text-white/80
                    "
                  >
                    Starting Price
                  </p>

                  <p
                    className="
                      mt-0.5
                      text-[13px]

                      sm:text-[17px]
                      font-extrabold
                      text-white
                    "
                  >
                    {item.price}
                  </p>
                </motion.div>

                {/* =================================================
                    TITLE OVER IMAGE
                ================================================= */}

                <div
                  className="
                    absolute
                    bottom-2.5
                    left-3
                    right-3

                    sm:bottom-4
                    sm:left-4
                    sm:right-4
                    z-20
                  "
                >
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: 16,
                    }}
                    whileInView={{
                      opacity: 1,
                      y: 0,
                    }}
                    viewport={{
                      once: true,
                    }}
                    transition={{
                      delay: 0.28 + index * 0.08,
                      duration: 0.45,
                    }}
                  >
                    <p
                      className="
                        text-[8px]
                        font-bold

                        sm:text-[10px]
                        uppercase
                        tracking-[0.15em]
                        text-[#FFC18A]
                      "
                    >
                      Dholera Investment
                    </p>

                    <h3
                      className="
                        mt-1
                        text-[17px]

                        sm:text-[22px]
                        font-extrabold
                        capitalize
                        leading-tight
                        text-white

                        md:text-[24px]
                      "
                    >
                      {item.title}
                    </h3>
                  </motion.div>
                </div>
              </div>

              {/* =================================================
                  CONTENT
              ================================================= */}

              <div
                className="
                  relative
                  p-3
                  sm:p-5
                  md:p-6
                "
              >
                {/* LIGHT ORANGE EFFECT */}

                <div
                  className="
                    pointer-events-none
                    absolute
                    -right-10
                    -top-10
                    h-28
                    w-28
                    rounded-full
                    bg-[#FF7A00]/5
                    blur-2xl
                  "
                />

                {/* SMALL LABEL */}

                <div
                  className="
                    flex
                    items-center
                    gap-2
                  "
                >
                  <span
                    className="
                      h-0.5
                      w-5
                      bg-[#FF7A00]

                      sm:w-7
                    "
                  />

                  <span
                    className="
                      text-[8px]
                      font-extrabold

                      sm:text-[10px]
                      uppercase
                      tracking-[0.16em]
                      text-[#FF7A00]
                    "
                  >
                    Property Details
                  </span>
                </div>

                {/* =================================================
                    DETAILS
                ================================================= */}

                <div className="mt-2 space-y-1.5 sm:mt-4 sm:space-y-2.5">
                  {item.details.map((detail, i) => {
                    const icons = [
                      <FaMapMarkerAlt key="location" />,
                      <FaBuilding key="type" />,
                      <FaRoad key="road" />,
                    ];

                    return (
                      <motion.div
                        key={detail}
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
                          delay:
                            0.3 +
                            index * 0.07 +
                            i * 0.07,
                          duration: 0.4,
                        }}
                        whileHover={{
                          x: 4,
                        }}
                        className="
                          group/detail
                          flex
                          min-h-8.5

                          sm:min-h-12
                          items-start
                          gap-2
                          rounded-lg
                          border
                          border-[#FF7A00]/8
                          bg-[#FFF9F4]
                          px-2
                          py-1.5

                          sm:px-3
                          sm:py-2.5
                          transition-all
                          duration-300

                          hover:border-[#FF7A00]/20
                          hover:bg-[#FFF0E2]
                        "
                      >
                        {/* ICON */}

                        <span
                          className="
                            flex
                            h-6
                            w-6

                            sm:h-8
                            sm:w-8
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            bg-white
                            text-[9px]
                            text-[#FF7A00]

                            sm:text-xs
                            shadow-sm
                            transition-all
                            duration-300

                            group-hover/detail:scale-110
                            group-hover/detail:bg-[#FF7A00]
                            group-hover/detail:text-white
                          "
                        >
                          {icons[i]}
                        </span>

                        {/* TEXT */}

                        <p
                          className="
                            pt-1
                            text-[10px]
                            font-medium
                            leading-3.75

                            sm:text-[12px]
                            sm:leading-5
                            text-gray-600
                            transition-colors
                            duration-300

                            group-hover/detail:text-[#081A3A]
                          "
                        >
                          {detail}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>

                {/* =================================================
                    BUTTONS
                ================================================= */}

                <div
                  className="
                    mt-3
                    flex
                    flex-row
                    gap-2

                    sm:mt-5
                  "
                >
                  {/* ENQUIRY */}

                  <motion.button
                    type="button"
                    onClick={() =>
                      handleEnquiryClick(item.title)
                    }
                    whileHover={{
                      y: -3,
                      scale: 1.02,
                    }}
                    whileTap={{
                      scale: 0.97,
                    }}
                    className="
                      group/enquiry
                      relative
                      flex
                      flex-1
                      items-center
                      justify-center
                      gap-2
                      overflow-hidden
                      rounded-xl
                      bg-[#FF7A00]
                      px-2
                      py-2
                      text-[10px]

                      sm:px-4
                      sm:py-3
                      sm:text-[12px]
                      font-bold
                      text-white
                      shadow-[0_10px_24px_rgba(255,122,0,0.22)]
                      transition-all
                      duration-300

                      hover:bg-[#FF9638]
                      hover:shadow-[0_14px_28px_rgba(255,122,0,0.28)]
                    "
                  >
                    {/* SHINE */}

                    <span
                      className="
                        absolute
                        -left-full
                        top-0
                        h-full
                        w-1/2
                        skew-x-[-25deg]
                        bg-linear-to-r
                        from-transparent
                        via-white/30
                        to-transparent
                        transition-all
                        duration-700

                        group-hover/enquiry:left-[130%]
                      "
                    />

                    <span className="relative z-10">
                      Enquiry
                    </span>

                    <FaArrowRight
                      className="
                        relative
                        z-10
                        text-[9px]
                        transition-transform

                        sm:text-xs
                        duration-300

                        group-hover/enquiry:translate-x-1.5
                      "
                    />
                  </motion.button>

                  {/* READ MORE */}

                  <motion.div
                    whileHover={{
                      y: -3,
                      scale: 1.02,
                    }}
                    whileTap={{
                      scale: 0.97,
                    }}
                    className="flex-1"
                  >
                    <Link
                      href={`/projects/${item.slug}`}
                      className="
                        group/read
                        flex
                        h-full
                        items-center
                        justify-center
                        gap-2
                        rounded-xl
                        border
                        border-[#FF7A00]
                        bg-white
                        px-2
                        py-2
                        text-[10px]

                        sm:px-4
                        sm:py-3
                        sm:text-[12px]
                        font-bold
                        text-[#FF7A00]
                        transition-all
                        duration-300

                        hover:bg-[#FFF0E2]
                        hover:text-[#FF7A00]
                        hover:shadow-[0_10px_24px_rgba(255,122,0,0.12)]
                      "
                    >
                      Read More

                      <FaArrowRight
                        className="
                          text-[9px]
                          transition-transform

                          sm:text-xs
                          duration-300

                          group-hover/read:translate-x-1.5
                        "
                      />
                    </Link>
                  </motion.div>
                </div>
              </div>

              {/* =================================================
                  BOTTOM ORANGE LINE
              ================================================= */}

              <span
                className="
                  absolute
                  bottom-0
                  left-0
                  h-1
                  w-0
                  bg-[#FF7A00]
                  transition-all
                  duration-700

                  group-hover:w-full
                "
              />
            </motion.article>
          ))}
        </div>
      </div>

      {/* =====================================================
          POPUP FORM
      ===================================================== */}

      <PopupForm
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        propertyName={selectedProperty}
      />
    </section>
  );
}