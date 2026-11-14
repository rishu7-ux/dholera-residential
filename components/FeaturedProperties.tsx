"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

import {
  FaMapMarkerAlt,
  FaRulerCombined,
  FaRoad,
  FaArrowRight,
} from "react-icons/fa";

import { MdOutlineVilla } from "react-icons/md";

import PopupForm from "@/components/PopupForm";

/* =========================================================
   PROPERTY DATA
========================================================= */

const properties = [
  

  {
    id: 1,
    title: "Ridhi 966/1 SCO Plots",
    image: "/images/ridhi-966-1.png",
    location: "Bhangadh Dholera",
    size: "423 - 590 Sq. Yd.",
    type: "TP 4, 4B-2",
    road: "FP Road 70 Mtr",
    price: "Starting Price - ₹65 Lakhs Onward",
    status: "Available",
    slug: "ridhi-966-1",
  },


  {
    id: 2,
    title: "Ridhi 249/2 Premium SCO Plots",
    image: "/images/Ridhi-249-2.jpg",
    location: "Kadipur Village",
    size: "390 | 578 | 687 Sq. Yd.",
    type: "TP-1",
    road: "55 M Road",
    price: "Starting Price - ₹62.40 Lakhs",
    status: "Sold Out",
    slug: "ridhi-249-2",
  },

  {
    id: 3,
    title: "Sidhi-857",
    image: "/images/Sidhi-857.jpg",
    location: "TP 4-B2, Bhangadh Village",
    size: "390 - 450 Sq. Yd.",
    type: "TP 4/B2",
    road: "48 M Main Road",
    price: "Starting Price - ₹62.40 Lakhs",
    status: "Sold Out",
    slug: "sidhi-857",
  },

  
];

/* =========================================================
   CARD ANIMATION
========================================================= */

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 35,
    scale: 0.98,
  },

  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,

    transition: {
      delay: index * 0.07,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

/* =========================================================
   INFO ITEM
========================================================= */

function InfoItem({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <motion.div
      whileHover={{
        y: -2,
      }}
      className="
        group/info
        flex
        min-w-0
        items-center
        gap-2
        rounded-xl
        bg-[#FFF9F4]
        px-2.5
        py-2.5
        transition-all
        duration-300

        hover:bg-[#FFF0E2]

        sm:gap-2.5
        sm:px-3
        sm:py-3
      "
    >
      <span
        className="
          flex
          h-8
          w-8
          shrink-0
          items-center
          justify-center
          rounded-lg
          bg-[#FFF0E2]
          text-xs
          text-[#FF7A00]
          transition-all
          duration-300

          group-hover/info:scale-110
          group-hover/info:bg-[#FF7A00]
          group-hover/info:text-white

          sm:h-9
          sm:w-9
          sm:text-sm
        "
      >
        {icon}
      </span>

      <span
        className="
          min-w-0
          text-[11px]
          font-semibold
          leading-4
          text-gray-600
          transition-colors
          duration-300

          group-hover/info:text-[#081A3A]

          sm:text-[13px]
          sm:leading-5

          lg:text-sm
        "
      >
        {value}
      </span>
    </motion.div>
  );
}

/* =========================================================
   PROPERTY CARD
========================================================= */

function PropertyCard({
  item,
  index,
  onEnquire,
}: {
  item: (typeof properties)[number];
  index: number;
  onEnquire: (title: string) => void;
}) {
  const isSoldOut = item.status === "Sold Out";

  return (
    <motion.article
      custom={index}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{
        once: true,
        amount: 0.15,
      }}
      whileHover={{
        y: -5,
      }}
      className="
        group
        
        relative
        overflow-hidden
        rounded-[22px]
        border
        border-[#FF7A00]/15
        bg-white
        shadow-[0_12px_36px_rgba(8,26,58,0.07)]
        transition-all
        duration-500

        hover:border-[#FF7A00]/30
        hover:shadow-[0_22px_55px_rgba(255,122,0,0.13)]
      "
    >
      {/* TOP ORANGE LINE */}

      <span
        className="
          absolute
          left-0
          top-0
          z-40
          h-0.75
          w-0
          bg-[#FF7A00]
          transition-all
          duration-700

          group-hover:w-full
        "
      />

      <div
        className="
          grid

          lg:grid-cols-[38%_62%]
        "
      >
        {/* =================================================
            IMAGE
        ================================================= */}

        <div
          className="
            relative
            h-63.75
            w-full
            overflow-hidden
            bg-black

            sm:h-72.5

            lg:h-full
            lg:min-h-83.75
          "
        >
          <Image
            src={item.image}
            alt={item.title}
            fill
            priority={index === 0}
            sizes="
              (max-width: 1024px) 100vw,
              38vw
            "
            className={`
              scale-[1.03]
              object-cover
              object-center
              transition-transform
              duration-900
              ease-[cubic-bezier(0.22,1,0.36,1)]

              group-hover:scale-[1.05]
              ${
                isSoldOut
                  ? "blur-[3px] brightness-[0.62] saturate-[0.72]"
                  : ""
              }
            `}
          />

          {/* OVERLAY */}

          <div
            className="
              pointer-events-none
              absolute
              inset-0
              z-10
              bg-linear-to-t
              from-black/30
              via-transparent
              to-transparent
            "
          />

          {isSoldOut && (
            <div
              className="
                pointer-events-none
                absolute
                inset-0
                z-20
                flex
                items-center
                justify-center
              "
            >
              <div
                className="
                  -rotate-10
                  border-y-4
                  border-white/90
                  bg-[#C94F00]/95
                  px-7
                  py-2.5
                  text-center
                  text-xl
                  font-black
                  uppercase
                  tracking-[0.18em]
                  text-white
                  shadow-[0_12px_35px_rgba(74,24,0,0.32)]
                  backdrop-blur-[2px]

                  sm:px-10
                  sm:py-3
                  sm:text-2xl

                  lg:text-3xl
                "
              >
                Sold Out
              </div>
            </div>
          )}

          {isSoldOut && (
            <motion.div
              initial={{
                opacity: 0,
                x: -15,
              }}
              whileInView={{
                opacity: 1,
                x: 0,
              }}
              viewport={{ once: true }}
              transition={{
                delay: 0.2 + index * 0.05,
                duration: 0.4,
              }}
              className="
                absolute
                left-4
                top-4
                z-20

                sm:left-5
                sm:top-5
              "
            >
              <span
                className="
                  inline-flex
                  rounded-xl
                  bg-[#C94F00]
                  px-4
                  py-2
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.12em]
                  text-white
                  shadow-[0_8px_22px_rgba(255,122,0,0.28)]

                  sm:text-xs
                "
              >
                Sold Out
              </span>
            </motion.div>
          )}

          {/* PRICE */}

          <motion.div
            initial={{
              opacity: 0,
              y: 15,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{ once: true }}
            transition={{
              delay: 0.3 + index * 0.05,
              duration: 0.45,
            }}
            className="
              absolute
              bottom-4
              left-4
              right-4
              z-20

              sm:bottom-5
              sm:left-5
              sm:right-auto
            "
          >
            <div
              className="
                inline-flex
                max-w-full
                rounded-xl
                border
                border-white/20
                bg-black/55
                px-4
                py-2.5
                text-[12px]
                font-semibold
                text-white
                shadow-[0_10px_28px_rgba(0,0,0,0.22)]
                backdrop-blur-sm

                sm:text-sm
              "
            >
              <span className="font-black uppercase tracking-[0.08em]">
                {isSoldOut ? item.status : item.price}
              </span>
            </div>
          </motion.div>
        </div>

        {/* =================================================
            CONTENT
        ================================================= */}

        <div
          className="
            flex
            flex-col
            justify-center
            bg-white
            px-4
            py-5
            transition-all
            duration-500

            group-hover:bg-[#FFF9F4]

            sm:px-6
            sm:py-6

            lg:min-h-83.75
            lg:px-9
            lg:py-7
          "
        >
          {/* TITLE */}

          <motion.h3
            whileHover={{
              x: 3,
            }}
            className="
              text-[26px]
              font-extrabold
              leading-[1.12]
              text-[#081A3A]
              transition-colors
              duration-300

              group-hover:text-[#FF7A00]

              sm:text-3xl
              lg:text-[32px]
            "
          >
            {item.title}
          </motion.h3>

          {/* TITLE LINE */}

          <span
            className="
              mt-3
              block
              h-0.75
              w-10
              rounded-full
              bg-[#FF7A00]
              transition-all
              duration-500

              group-hover:w-20
            "
          />

          {isSoldOut && (
            <div className="mt-3">
              <span
                className="
                  inline-flex
                  items-center
                  rounded-full
                  border
                  border-[#C94F00]/15
                  bg-[#FFF0E6]
                  px-3
                  py-1.5
                  text-[10px]
                  font-black
                  uppercase
                  tracking-[0.12em]
                  text-[#C94F00]
                  sm:text-[11px]
                "
              >
                Sold Out
              </span>
            </div>
          )}

          {/* LOCATION */}

          <motion.div
            whileHover={{
              x: 3,
            }}
            className="
              group/location
              mt-4
              flex
              items-center
              gap-3
              text-[15px]
              font-medium
              text-gray-600

              sm:mt-5
              sm:text-base
            "
          >
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
                text-[#FF7A00]
                transition-all
                duration-300

                group-hover/location:scale-110
                group-hover/location:bg-[#FF7A00]
                group-hover/location:text-white
              "
            >
              <FaMapMarkerAlt />
            </span>

            <span className="leading-5">
              {item.location}
            </span>
          </motion.div>

          {/* =================================================
              DETAILS - COMPACT
          ================================================= */}

          <div
            className="
              mt-4
              grid
              grid-cols-3
              gap-2

              sm:mt-5
              sm:gap-3
            "
          >
            <InfoItem
              icon={<FaRulerCombined />}
              value={item.size}
            />

            <InfoItem
              icon={<MdOutlineVilla />}
              value={item.type}
            />

            <InfoItem
              icon={<FaRoad />}
              value={item.road}
            />
          </div>

          {/* =================================================
              BUTTONS
          ================================================= */}

          <div
            className="
              mt-5
              grid
              grid-cols-2
              gap-2.5

              sm:mt-6
              sm:gap-3
            "
          >
            {/* ENQUIRY */}

            <motion.button
              type="button"
              onClick={() => onEnquire(item.title)}
              whileHover={{
                y: -2,
                scale: 1.01,
              }}
              whileTap={{
                scale: 0.98,
              }}
              className="
                group/enquiry
                flex
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-[#FF7A00]
                px-3
                py-3
                text-[13px]
                font-bold
                text-white
                shadow-[0_8px_22px_rgba(255,122,0,0.22)]
                transition-all
                duration-300

                hover:bg-[#FF9638]

                sm:px-6
                sm:py-3.5
                sm:text-sm
              "
            >
              Enquire Now

              <FaArrowRight
                className="
                  text-[10px]
                  transition-transform
                  duration-300

                  group-hover/enquiry:translate-x-1
                "
              />
            </motion.button>

            {/* READ MORE */}

            <motion.div
              whileHover={{
                y: -2,
                scale: 1.01,
              }}
              whileTap={{
                scale: 0.98,
              }}
            >
              <Link
                href={`/properties/${item.slug}`}
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
                  px-3
                  py-3
                  text-[13px]
                  font-bold
                  text-[#081A3A]
                  transition-all
                  duration-300

                  hover:bg-[#FFF0E2]
                  hover:text-[#FF7A00]

                  sm:px-6
                  sm:py-3.5
                  sm:text-sm
                "
              >
                Read More

                <FaArrowRight
                  className="
                    text-[10px]
                    transition-transform
                    duration-300

                    group-hover/read:translate-x-1
                  "
                />
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* =========================================================
   FEATURED PROPERTIES
========================================================= */

export default function FeaturedProperties() {
  const [popupOpen, setPopupOpen] = useState(false);

  const [selectedProperty, setSelectedProperty] =
    useState<string | undefined>(undefined);

  const handleEnquire = (title: string) => {
    setSelectedProperty(title);
    setPopupOpen(true);
  };

  const handleClose = () => {
    setPopupOpen(false);
    setSelectedProperty(undefined);
  };

  return (
    <section
      className="
        relative
        overflow-hidden
        bg-[#F8FAFC]
        py-16

        md:py-20
      "
    >
      <div
        className="
          relative
          mx-auto
          max-w-7xl
          px-4

          sm:px-6
        "
      >
        {/* HEADER */}

        <motion.div
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
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            mb-10
            max-w-4xl

            md:mb-12
          "
        >
          <div
            className="
              mb-3
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
                width: 40,
              }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
              }}
              className="
                h-0.5
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
              Featured Properties
            </span>
          </div>

          <h2
            className="
              text-3xl
              font-extrabold
              leading-tight
              text-[#081A3A]

              sm:text-4xl
              md:text-5xl
            "
          >
            SCO &amp; Residential Plots in{" "}

            <span className="text-[#FF7A00]">
              Dholera Smart City
            </span>
          </h2>

          <p
            className="
              mt-3
              text-base
              text-gray-600

              sm:text-lg
            "
          >
            Sold-out projects are shown for reference. You can still enquire for resale, future inventory, or similar properties.
          </p>
        </motion.div>

        {/* PROPERTY LIST */}

        <div className="space-y-6 md:space-y-8">
          {properties.map((item, index) => (
            <PropertyCard
              key={item.id}
              item={item}
              index={index}
              onEnquire={handleEnquire}
            />
          ))}
        </div>
      </div>

      {/* POPUP FORM */}

      <PopupForm
        open={popupOpen}
        onClose={handleClose}
        propertyName={selectedProperty}
      />
    </section>
  );
}
