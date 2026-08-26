"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaBuilding,
  FaLocationDot,
  FaArrowTrendUp,
} from "react-icons/fa6";

/* =========================================================
   RUNNING WORDS
========================================================= */

const runningWords = [
  "Dholera Smart City",
  "TP4B2, Bhangadh",
  "From ₹65 Lakhs",
];

/* =========================================================
   RUNNING WORD COMPONENT
========================================================= */

function RunningWords() {
  const [currentWord, setCurrentWord] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWord((prev) =>
        prev === runningWords.length - 1
          ? 0
          : prev + 1
      );
    }, 2200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="
        relative
        mt-2
        flex
        min-h-13
        items-center
        overflow-hidden

        sm:min-h-15.5
        md:min-h-18
        lg:min-h-19.5
      "
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={currentWord}
          initial={{
            opacity: 0,
            y: 35,
            filter: "blur(6px)",
          }}
          animate={{
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
          }}
          exit={{
            opacity: 0,
            y: -35,
            filter: "blur(6px)",
          }}
          transition={{
            duration: 0.55,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            absolute
            left-0

            text-3xl
            font-extrabold
            leading-tight
            tracking-tight

            text-[#FF7A00]

            sm:text-4xl
            md:text-5xl
            lg:text-[58px]
          "
        >
          {runningWords[currentWord]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/* =========================================================
   PROPERTY INTRO
========================================================= */

export default function PropertyIntro() {
  return (
    <section
      className="
        relative
        overflow-hidden
        bg-white
        py-20

        md:py-24
      "
    >
      {/* =====================================================
          BACKGROUND EFFECT
      ===================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          -left-32
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
          -right-32
          bottom-0
          h-96
          w-96
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
        <div
          className="
            grid
            items-center
            gap-12

            lg:grid-cols-[1.3fr_0.7fr]
            lg:gap-16
          "
        >
          {/* =================================================
              LEFT SECTION
          ================================================= */}

          <div>
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
                duration: 0.55,
              }}
              className="
                mb-5
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
                  font-extrabold
                  uppercase
                  tracking-[0.19em]
                  text-[#FF7A00]
                "
              >
                Premium Investment Opportunities
              </span>
            </motion.div>

            {/* =================================================
                STATIC + RUNNING WORD HEADING
            ================================================= */}

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
                amount: 0.2,
              }}
              transition={{
                duration: 0.7,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <h1
                className="
                  text-3xl
                  font-extrabold
                  leading-[1.15]
                  tracking-tight
                  text-[#081A3A]

                  sm:text-4xl
                  md:text-5xl
                  lg:text-[58px]
                "
              >
                SCO &amp; Mixed Use Plot
              </h1>

              <RunningWords />
            </motion.div>

            {/* =================================================
                SUB HEADING
            ================================================= */}

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
                duration: 0.7,
                delay: 0.15,
              }}
              className="mt-12"
            >
              <div className="flex items-center gap-3">
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
                  <FaBuilding />
                </span>

                <span
                  className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-[0.18em]
                    text-[#FF7A00]
                  "
                >
                  Property Investment
                </span>
              </div>

              <h2
                className="
                  mt-5
                  text-2xl
                  font-extrabold
                  leading-tight
                  text-[#081A3A]

                  sm:text-3xl
                  md:text-4xl
                "
              >
                Dholera Smart City{" "}
                <span className="text-[#FF7A00]">
                  Properties
                </span>
              </h2>

              <motion.div
                initial={{
                  width: 0,
                }}
                whileInView={{
                  width: 72,
                }}
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.7,
                  delay: 0.2,
                }}
                className="
                  mt-5
                  h-0.75
                  rounded-full
                  bg-[#FF7A00]
                "
              />

              <p
                className="
                  mt-6
                  max-w-2xl
                  text-[16px]
                  leading-8
                  text-gray-600

                  sm:text-[17px]
                  md:text-lg
                "
              >
                Building dreams, one home at a time. Discover premium
                residential, SCO and commercial plots in India&apos;s first
                smart city with excellent investment opportunities and
                world-class infrastructure.
              </p>
            </motion.div>

            {/* =================================================
                INFORMATION CARDS
            ================================================= */}

            <motion.div
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
                duration: 0.6,
                delay: 0.25,
              }}
              className="
                mt-9
                grid
                gap-4

                sm:grid-cols-2
              "
            >
              {/* LOCATION */}

              <motion.div
                whileHover={{
                  y: -5,
                }}
                className="
                  group
                  flex
                  items-center
                  gap-4
                  rounded-2xl
                  border
                  border-[#FF7A00]/10
                  bg-[#FFF9F4]
                  p-4
                  transition-all
                  duration-300

                  hover:border-[#FF7A00]/25
                  hover:bg-[#FFF0E2]
                  hover:shadow-[0_12px_30px_rgba(255,122,0,0.10)]
                "
              >
                <span
                  className="
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    bg-white
                    text-[#FF7A00]
                    shadow-sm
                    transition-all
                    duration-300

                    group-hover:scale-110
                    group-hover:bg-[#FF7A00]
                    group-hover:text-white
                  "
                >
                  <FaLocationDot />
                </span>

                <div>
                  <p
                    className="
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-[0.15em]
                      text-gray-400
                    "
                  >
                    Prime Location
                  </p>

                  <p
                    className="
                      mt-1
                      text-sm
                      font-extrabold
                      text-[#081A3A]
                    "
                  >
                    TP4B2, Bhangadh
                  </p>
                </div>
              </motion.div>

              {/* PRICE */}

              <motion.div
                whileHover={{
                  y: -5,
                }}
                className="
                  group
                  flex
                  items-center
                  gap-4
                  rounded-2xl
                  border
                  border-[#FF7A00]/10
                  bg-[#FFF9F4]
                  p-4
                  transition-all
                  duration-300

                  hover:border-[#FF7A00]/25
                  hover:bg-[#FFF0E2]
                  hover:shadow-[0_12px_30px_rgba(255,122,0,0.10)]
                "
              >
                <span
                  className="
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    bg-white
                    text-[#FF7A00]
                    shadow-sm
                    transition-all
                    duration-300

                    group-hover:scale-110
                    group-hover:bg-[#FF7A00]
                    group-hover:text-white
                  "
                >
                  <FaArrowTrendUp />
                </span>

                <div>
                  <p
                    className="
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-[0.15em]
                      text-gray-400
                    "
                  >
                    Starting Investment
                  </p>

                  <p
                    className="
                      mt-1
                      text-sm
                      font-extrabold
                      text-[#081A3A]
                    "
                  >
                    From ₹65 Lakhs
                  </p>
                </div>
              </motion.div>
            </motion.div>

            {/* =================================================
                SMALL ANIMATION
            ================================================= */}

            <motion.div
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
                duration: 0.6,
                delay: 0.35,
              }}
              className="
                mt-10
                flex
                items-center
                gap-4
              "
            >
              <motion.div
                animate={{
                  width: [35, 80, 35],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="
                  h-0.75
                  rounded-full
                  bg-[#FF7A00]
                "
              />

              <span
                className="
                  h-1.5
                  w-1.5
                  rounded-full
                  bg-[#081A3A]
                "
              />

              <span
                className="
                  text-xs
                  font-semibold
                  uppercase
                  tracking-[0.16em]
                  text-gray-400
                "
              >
                Dholera Smart City
              </span>
            </motion.div>
          </div>

          {/* =================================================
              RIGHT PREMIUM CARD
          ================================================= */}

          <motion.div
            initial={{
              opacity: 0,
              x: 45,
              scale: 0.96,
            }}
            whileInView={{
              opacity: 1,
              x: 0,
              scale: 1,
            }}
            viewport={{
              once: true,
              amount: 0.2,
            }}
            transition={{
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
            whileHover={{
              y: -6,
            }}
            className="
              relative
              mx-auto
              w-full
              max-w-95
              overflow-hidden
              rounded-[28px]
              border
              border-[#FF7A00]/15
              bg-linear-to-b
              from-[#FFF8F2]
              to-[#FFEAD8]
              p-7
              shadow-[0_20px_55px_rgba(8,26,58,0.10)]

              lg:mx-0
              lg:ml-auto
            "
          >
            {/* TOP BORDER */}

            <span
              className="
                absolute
                left-0
                top-0
                h-1
                w-full
                bg-[#FF7A00]
              "
            />

            {/* LABEL */}

            <p
              className="
                text-xs
                font-bold
                uppercase
                tracking-[0.18em]
                text-[#FF7A00]
              "
            >
              Investment Highlight
            </p>

            {/* PRICE */}

            <h3
              className="
                mt-3
                text-3xl
                font-extrabold
                text-[#081A3A]
              "
            >
              From{" "}
              <span className="text-[#FF7A00]">
                ₹65 Lakhs
              </span>
            </h3>

            {/* DESCRIPTION */}

            <p
              className="
                mt-4
                text-sm
                leading-7
                text-gray-600
              "
            >
              Invest in Dholera&apos;s future with carefully selected
              residential, SCO, and commercial plot opportunities.
            </p>

            {/* DIVIDER */}

            <div className="my-6 h-px bg-[#FF7A00]/15" />

            {/* FEATURES */}

            <div className="space-y-4">
              {[
                "FP Road 70 m",
                "Near Tata Semiconductor Plant",
                "On Metro Rail Corridor",
              ].map((item, index) => (
                <motion.div
                  key={item}
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
                    delay: 0.25 + index * 0.1,
                    duration: 0.4,
                  }}
                  whileHover={{
                    x: 5,
                  }}
                  className="
                    group
                    flex
                    items-center
                    gap-3
                    rounded-xl
                    p-2
                    transition-all
                    duration-300

                    hover:bg-white/60
                  "
                >
                  <span
                    className="
                      flex
                      h-7
                      w-7
                      shrink-0
                      items-center
                      justify-center
                      rounded-lg
                      bg-[#FFF0E2]
                    "
                  >
                    <span
                      className="
                        h-2
                        w-2
                        rounded-full
                        bg-[#FF7A00]
                        transition-all
                        duration-300

                        group-hover:scale-150
                      "
                    />
                  </span>

                  <span
                    className="
                      text-sm
                      font-medium
                      text-[#081A3A]
                      transition-colors
                      duration-300

                      group-hover:text-[#FF7A00]
                    "
                  >
                    {item}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}