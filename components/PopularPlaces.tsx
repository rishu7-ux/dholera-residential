"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { FaMapMarkerAlt, FaArrowRight } from "react-icons/fa";

const places = [
  {
    id: 1,
    title: "Bhangadh",
    image: "/images/bhangadh.jpg",
    properties: "47 Properties",
    description:
      "Founded with a vision to contribute to India’s next-generation industrial revolution,",
  },
  {
    id: 2,
    title: "Gujrat",
    image: "/images/gujrat.jpg",
    properties: "24 Properties",
    description:
      "Founded with a vision to contribute to India’s next-generation industrial revolution,",
  },
  {
    id: 3,
    title: "Sandhida",
    image: "/images/sandhida.jpg",
    properties: "64 Properties",
    description:
      "Founded with a vision to contribute to India’s next-generation industrial revolution,",
  },
];

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 45,
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

export default function PopularPlaces() {
  return (
    <section className="relative overflow-hidden bg-[#FAFAFA] py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mb-14 max-w-3xl"
        >
          <div className="mb-4 flex items-center gap-3">
            <motion.span
              initial={{ width: 0 }}
              whileInView={{ width: 42 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: 0.15,
              }}
              className="h-0.5 rounded-full bg-[#FF7A00]"
            />

            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7A00]">
              Explore Locations
            </span>
          </div>

          <h2 className="text-3xl font-extrabold text-[#081A3A] sm:text-4xl md:text-5xl">
            Popular
            <span className="text-[#FF7A00]"> Places</span>
          </h2>

          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
            Founded with a vision to contribute to India’s next-generation
            industrial revolution,.
          </p>

          <motion.div
            animate={{
              width: [45, 90, 45],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="mt-6 h-0.75 rounded-full bg-[#FF7A00]"
          />
        </motion.div>

        {/* CARDS */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {places.map((place, index) => (
            <motion.article
              key={place.id}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{
                once: true,
                amount: 0.2,
              }}
              whileHover={{
                y: -10,
                scale: 1.015,
              }}
              transition={{
                duration: 0.3,
                ease: "easeOut",
              }}
              className="
                group
                relative
                overflow-hidden
                rounded-[26px]
                border
                border-gray-200
                bg-white
                shadow-[0_12px_35px_rgba(8,26,58,0.08)]
                transition-shadow
                duration-500
                hover:shadow-[0_25px_60px_rgba(8,26,58,0.14)]
              "
            >
              {/* IMAGE */}
              <div className="relative h-70 overflow-hidden">
                <Image
                  src={place.image}
                  alt={place.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="
                    object-cover
                    transition-transform
                    duration-1100
                    ease-[cubic-bezier(0.22,1,0.36,1)]
                    group-hover:scale-110
                  "
                />

                {/* VERY LIGHT IMAGE OVERLAY */}
                <div
                  className="
                    absolute
                    inset-0
                    bg-linear-to-t
                    from-black/25
                    via-transparent
                    to-transparent
                    transition-all
                    duration-500
                    group-hover:from-black/35
                  "
                />

                {/* PROPERTY BADGE */}
                <motion.div
                  initial={{
                    opacity: 0,
                    y: -12,
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                  }}
                  viewport={{ once: true }}
                  transition={{
                    delay: 0.2 + index * 0.08,
                    duration: 0.45,
                  }}
                  className="absolute right-5 top-5 z-20"
                >
                  <span
                    className="
                      rounded-full
                      border
                      border-white/70
                      bg-white/90
                      px-4
                      py-2
                      text-xs
                      font-bold
                      text-[#0A2E73]
                      shadow-md
                      backdrop-blur-md
                      transition-all
                      duration-300

                      group-hover:bg-[#FF7A00]
                      group-hover:text-white
                    "
                  >
                    {place.properties}
                  </span>
                </motion.div>
              </div>

              {/* CONTENT */}
              <div className="relative p-6 sm:p-7">
                {/* SMALL ICON */}
                <motion.div
                  whileHover={{
                    rotate: 7,
                    scale: 1.08,
                  }}
                  className="
                    mb-4
                    flex
                    h-11
                    w-11
                    items-center
                    justify-center
                    rounded-xl
                    bg-[#FFF1E5]
                    text-[#FF7A00]
                    transition-all
                    duration-300
                    group-hover:bg-[#FF7A00]
                    group-hover:text-white
                  "
                >
                  <FaMapMarkerAlt />
                </motion.div>

                {/* TITLE */}
                <h3
                  className="
                    text-3xl
                    font-extrabold
                    text-[#081A3A]
                    transition-all
                    duration-300
                    group-hover:translate-x-1
                    group-hover:text-[#FF7A00]
                  "
                >
                  {place.title}
                </h3>

                {/* UNDERLINE */}
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

                {/* DESCRIPTION */}
                <p
                  className="
                    mt-4
                    text-sm
                    leading-7
                    text-gray-600
                    transition-colors
                    duration-300
                    group-hover:text-[#374151]
                    sm:text-base
                  "
                >
                  {place.description}
                </p>

                {/* BOTTOM ACTION */}
                <div
                  className="
                    mt-6
                    flex
                    items-center
                    justify-between
                    border-t
                    border-gray-100
                    pt-5
                  "
                >
                  <span className="text-sm font-semibold text-[#0A2E73]">
                    Explore Location
                  </span>

                  <motion.span
                    whileHover={{
                      x: 4,
                    }}
                    className="
                      flex
                      h-9
                      w-9
                      items-center
                      justify-center
                      rounded-full
                      bg-[#FFF1E5]
                      text-[#FF7A00]
                      transition-all
                      duration-300
                      group-hover:bg-[#0A2E73]
                      group-hover:text-white
                    "
                  >
                    <FaArrowRight className="text-xs" />
                  </motion.span>
                </div>

                {/* BOTTOM HOVER LINE */}
                <span
                  className="
                    absolute
                    bottom-0
                    left-0
                    h-0.75
                    w-0
                    bg-linear-to-r
                    from-[#FF7A00]
                    to-[#0A2E73]
                    transition-all
                    duration-700
                    group-hover:w-full
                  "
                />
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}