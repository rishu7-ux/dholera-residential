"use client";

import Image from "next/image";
import CountUp from "react-countup";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

import {
  FaPercent,
  FaHome,
  FaUserTie,
  FaBriefcase,
} from "react-icons/fa";

const stats = [
  {
    icon: <FaPercent />,
    number: 967,
    title: "Listings For Sale",
  },
  {
    icon: <FaHome />,
    number: 1276,
    title: "Listings For Rent",
  },
  {
    icon: <FaUserTie />,
    number: 396,
    title: "Agents",
  },
  {
    icon: <FaBriefcase />,
    number: 177,
    title: "Brokers",
  },
];

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 50,
    scale: 0.94,
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

export default function StatsSection() {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.25,
  });

  return (
    <section
      ref={ref}
      className="
        relative
        overflow-hidden
        py-20
        md:py-24
      "
    >
      {/* =========================
          BACKGROUND IMAGE
      ========================= */}

      <div className="absolute inset-0">
        <Image
          src="/images/stats-bg.jpg"
          alt="Dholera Property Statistics"
          fill
          sizes="100vw"
          className="
            object-cover
            transition-transform
            duration-4000
          "
        />
      </div>

      {/* =========================
          BLUE OVERLAY
      ========================= */}

      <div
        className="
          absolute
          inset-0
          bg-linear-to-r
          from-[#081A3A]/95
          via-[#0A2E73]/90
          to-[#081A3A]/85
        "
      />

      {/* subtle bottom overlay */}
      <div
        className="
          absolute
          inset-x-0
          bottom-0
          h-40
          bg-linear-to-t
          from-[#081A3A]/60
          to-transparent
        "
      />

      {/* =========================
          CONTENT
      ========================= */}

      <div
        className="
          relative
          z-10
          mx-auto
          max-w-7xl
          px-5
          sm:px-6
        "
      >
        {/* =========================
            HEADING
        ========================= */}

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
            amount: 0.3,
          }}
          transition={{
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            mb-12
            text-center
          "
        >
          <motion.div
            initial={{
              opacity: 0,
              y: -10,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{ once: true }}
            transition={{
              duration: 0.5,
            }}
            className="
              mx-auto
              mb-4
              flex
              w-fit
              items-center
              gap-3
            "
          >
            <motion.span
              initial={{
                width: 0,
              }}
              whileInView={{
                width: 35,
              }}
              viewport={{ once: true }}
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
              Our Achievements
            </span>

            <motion.span
              initial={{
                width: 0,
              }}
              whileInView={{
                width: 35,
              }}
              viewport={{ once: true }}
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
          </motion.div>

          <h2
            className="
              text-3xl
              font-extrabold
              text-white
              sm:text-4xl
              md:text-5xl
            "
          >
            Trusted Property
            <span className="text-[#FF7A00]">
              {" "}
              Experience
            </span>
          </h2>

          <p
            className="
              mx-auto
              mt-4
              max-w-2xl
              text-sm
              leading-7
              text-white/70
              sm:text-base
            "
          >
            Building trust and delivering premium real estate opportunities
            with experience and commitment.
          </p>
        </motion.div>

        {/* =========================
            STATS GRID
        ========================= */}

        <div
          className="
            grid
            grid-cols-2
            gap-4
            md:gap-6
            lg:grid-cols-4
          "
        >
          {stats.map((item, index) => (
            <motion.div
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
                y: -10,
                scale: 1.025,
              }}
              whileTap={{
                scale: 0.98,
              }}
              className="
                group
                relative
                overflow-hidden
                rounded-3xl
                border
                border-white/15
                bg-white/10
                px-4
                py-8
                text-center
                shadow-[0_14px_40px_rgba(0,0,0,0.15)]
                backdrop-blur-md
                transition-all
                duration-500

                hover:border-[#FF7A00]/60
                hover:bg-white/[0.14]
                hover:shadow-[0_25px_55px_rgba(0,0,0,0.25)]

                sm:px-6
                sm:py-9
              "
            >
              {/* =========================
                  TOP ANIMATED BORDER
              ========================= */}

              <span
                className="
                  absolute
                  left-1/2
                  top-0
                  h-0.75
                  w-0
                  -translate-x-1/2
                  rounded-full
                  bg-[#FF7A00]
                  transition-all
                  duration-500
                  group-hover:w-full
                "
              />

              {/* =========================
                  SHINE EFFECT
              ========================= */}

              <span
                className="
                  pointer-events-none
                  absolute
                  left-[-80%]
                  top-0
                  h-full
                  w-[40%]
                  -skew-x-12
                  bg-linear-to-r
                  from-transparent
                  via-white/15
                  to-transparent
                  opacity-0
                  transition-all
                  duration-1000

                  group-hover:left-[140%]
                  group-hover:opacity-100
                "
              />

              {/* =========================
                  ICON
              ========================= */}

              <motion.div
                whileHover={{
                  rotate: 8,
                  scale: 1.08,
                }}
                transition={{
                  duration: 0.3,
                }}
                className="
                  relative
                  mx-auto
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-[#FF7A00]/30
                  bg-[#FF7A00]/10
                  text-2xl
                  text-[#FF7A00]
                  transition-all
                  duration-500

                  group-hover:border-[#FF7A00]
                  group-hover:bg-[#FF7A00]
                  group-hover:text-white
                  group-hover:shadow-[0_10px_25px_rgba(255,122,0,0.30)]

                  sm:h-20
                  sm:w-20
                  sm:text-3xl
                "
              >
                {item.icon}
              </motion.div>

              {/* =========================
                  COUNTER
              ========================= */}

              <motion.h3
                initial={{
                  opacity: 0,
                  y: 15,
                }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                }}
                viewport={{
                  once: true,
                }}
                transition={{
                  delay: 0.25 + index * 0.08,
                  duration: 0.5,
                }}
                className="
                  mt-5
                  text-3xl
                  font-extrabold
                  text-white
                  transition-all
                  duration-300

                  group-hover:scale-110
                  group-hover:text-[#FF7A00]

                  sm:text-4xl
                  md:text-5xl
                "
              >
                {inView && (
                  <CountUp
                    end={item.number}
                    duration={2.5}
                    separator=","
                  />
                )}

                <span className="text-[#FF7A00]">
                  +
                </span>
              </motion.h3>

              {/* =========================
                  TITLE
              ========================= */}

              <p
                className="
                  mt-3
                  text-sm
                  font-medium
                  text-white/70
                  transition-all
                  duration-300

                  group-hover:-translate-y-1
                  group-hover:text-white

                  sm:text-base
                "
              >
                {item.title}
              </p>

              {/* =========================
                  BOTTOM LINE
              ========================= */}

              <span
                className="
                  mx-auto
                  mt-5
                  block
                  h-0.5
                  w-8
                  rounded-full
                  bg-[#FF7A00]/60
                  transition-all
                  duration-500

                  group-hover:w-16
                  group-hover:bg-[#FF7A00]
                "
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}