"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import {
  FaBuilding,
  FaHome,
  FaIndustry,
  FaStore,
  FaArrowRight,
} from "react-icons/fa";

const services = [
  {
    title: "Commercial Plot",
    description:
      "Prime commercial plots for business and investment in Dholera.",
    icon: FaBuilding,
    href: "/properties",
  },
  {
    title: "Residential Plot",
    description:
      "Well-planned residential plots with strong future growth.",
    icon: FaHome,
    href: "/properties",
  },
  {
    title: "Industrial Plot",
    description:
      "Industrial land near major infrastructure and growth zones.",
    icon: FaIndustry,
    href: "/properties",
  },
  {
    title: "Logistic Plot",
    description:
      "Logistics plots with strong connectivity to key corridors.",
    icon: FaStore,
    href: "/properties",
  },
];

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.96,
  },

  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,

    transition: {
      delay: index * 0.08,
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

export default function LookingFor() {
  return (
    <section className="bg-[#F8FAFC] py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* HEADER */}

        <motion.div
          initial={{
            opacity: 0,
            y: 18,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{
            once: true,
          }}
          transition={{
            duration: 0.5,
          }}
          className="mb-8"
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="h-0.5 w-8 bg-[#FF7A00]" />

            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF7A00] sm:text-xs">
              Property Categories
            </span>
          </div>

          <h2 className="text-3xl font-extrabold leading-tight text-[#081A3A] sm:text-4xl lg:text-5xl">
            What Are You{" "}
            <span className="text-[#FF7A00]">
              Looking For
            </span>
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
            Explore the right property category for your investment in Dholera.
          </p>
        </motion.div>

        {/* CUBE CARDS */}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {services.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.article
                key={item.title}
                custom={index}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{
                  once: true,
                  amount: 0.2,
                }}
                whileHover={{
                  y: -5,
                  scale: 1.02,
                }}
                className="
                  group
                  relative
                  aspect-square
                  overflow-hidden
                  rounded-[18px]
                  border
                  border-[#E7EAF0]
                  bg-white
                  p-4
                  shadow-[0_6px_18px_rgba(8,26,58,0.06)]
                  transition-all
                  duration-300

                  hover:border-[#FF7A00]/40
                  hover:shadow-[0_14px_30px_rgba(255,122,0,0.12)]

                  sm:p-5
                "
              >
                {/* TOP ACCENT */}

                <span className="absolute left-0 top-0 h-0.75 w-10 bg-[#FF7A00] transition-all duration-300 group-hover:w-full" />

                {/* ICON */}

                <div
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    bg-[#FFF1E5]
                    text-lg
                    text-[#FF7A00]
                    transition-all
                    duration-300

                    group-hover:bg-[#FF7A00]
                    group-hover:text-white

                    sm:h-12
                    sm:w-12
                    sm:text-xl
                  "
                >
                  <Icon />
                </div>

                {/* TITLE */}

                <h3 className="mt-4 text-[15px] font-extrabold leading-5 text-[#081A3A] transition-colors duration-300 group-hover:text-[#FF7A00] sm:text-lg">
                  {item.title}
                </h3>

                {/* LINE */}

                <span className="mt-2 block h-0.5 w-7 bg-[#FF7A00] transition-all duration-300 group-hover:w-12" />

                {/* DESCRIPTION */}

                <p className="mt-3 line-clamp-3 text-[11px] leading-5 text-gray-500 sm:text-xs">
                  {item.description}
                </p>

                {/* READ MORE */}

                <Link
                  href={item.href}
                  className="
                    absolute
                    bottom-4
                    left-4
                    inline-flex
                    items-center
                    gap-1.5
                    text-[11px]
                    font-bold
                    text-[#081A3A]
                    transition-colors
                    duration-300

                    hover:text-[#FF7A00]

                    sm:bottom-5
                    sm:left-5
                    sm:text-xs
                  "
                >
                  Read More

                  <FaArrowRight className="text-[9px]" />
                </Link>

                {/* BOTTOM ACCENT */}

                <span className="absolute bottom-0 left-0 h-0.75 w-0 bg-[#FF7A00] transition-all duration-300 group-hover:w-full" />
              </motion.article>
            );
          })}
        </div>

        {/* BUTTON */}

        <div className="mt-8 flex justify-center">
          <Link
            href="/properties"
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              bg-[#FF7A00]
              px-5
              py-3
              text-sm
              font-bold
              text-white
              transition-all
              duration-300

              hover:-translate-y-1
              hover:bg-[#0A2E73]
            "
          >
            Explore Properties

            <FaArrowRight className="text-xs" />
          </Link>
        </div>
      </div>
    </section>
  );
}