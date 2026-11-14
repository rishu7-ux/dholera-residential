"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FaBuilding,
  FaLocationDot,
  FaArrowTrendUp,
} from "react-icons/fa6";

/* =========================================================
   TYPEWRITER WORDS
========================================================= */

const rotatingWords = [
  "Dholera Smart City",
  "TP4B2, Bhangadh",
  "From ₹44 Lakhs",
];

/* =========================================================
   TYPEWRITER COMPONENT
========================================================= */

function TypewriterWords() {
  const [wordIndex, setWordIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const currentWord = rotatingWords[wordIndex];

    const timeout = setTimeout(
      () => {
        /* =====================================================
           TYPING
        ===================================================== */

        if (!deleting) {
          if (displayText.length < currentWord.length) {
            setDisplayText(
              currentWord.slice(
                0,
                displayText.length + 1
              )
            );
          } else {
            setDeleting(true);
          }
        }

        /* =====================================================
           DELETING
        ===================================================== */

        else {
          if (displayText.length > 0) {
            setDisplayText(
              currentWord.slice(
                0,
                displayText.length - 1
              )
            );
          } else {
            setDeleting(false);

            setWordIndex(
              (prev) =>
                (prev + 1) % rotatingWords.length
            );
          }
        }
      },

      deleting
        ? 45
        : displayText === currentWord
          ? 1400
          : 85
    );

    return () => clearTimeout(timeout);
  }, [displayText, deleting, wordIndex]);

  return (
    <div
      className="
        relative
        mt-3
        flex
        min-h-12
        items-center

        sm:min-h-14.5
        md:min-h-17
        lg:min-h-18.5
      "
    >
      <span
        className="
          inline-flex
          items-center
          text-3xl
          font-extrabold
          leading-tight
          tracking-tight
          text-[#FF7A00]

          sm:text-4xl
          md:text-[46px]
          lg:text-[54px]
        "
      >
        {displayText}

        {/* BLINKING CURSOR */}

        <motion.span
          animate={{
            opacity: [1, 0, 1],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="
            ml-1.5
            inline-block
            h-[0.88em]
            w-0.75
            rounded-full
            bg-[#FF7A00]
          "
        />
      </span>
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
          SOFT BACKGROUND EFFECT
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
        {/* =====================================================
            SMALL LABEL
        ===================================================== */}

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
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            mb-7
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
              tracking-[0.2em]
              text-[#FF7A00]
            "
          >
            Premium Investment Opportunities
          </span>
        </motion.div>

        {/* =====================================================
            FIXED HEADING + LETTER TYPEWRITER
        ===================================================== */}

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
          className="max-w-5xl"
        >
          {/* FIXED HEADING */}

          <h1
            className="
              text-3xl
              font-extrabold
              leading-[1.1]
              tracking-tight
              text-[#081A3A]

              sm:text-4xl
              md:text-[46px]
              lg:text-[54px]
            "
          >
            SCO &amp; Residential Plots in
          </h1>

          {/* ONLY LETTERS TYPE HERE */}

          <TypewriterWords />
        </motion.div>

        {/* =====================================================
            CONTENT
        ===================================================== */}

        <div
          className="
            mt-14
            grid
            items-start
            gap-10

            md:mt-16

            lg:grid-cols-[1fr_390px]
            lg:gap-14
          "
        >
          {/* =================================================
              LEFT CONTENT
          ================================================= */}

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
              amount: 0.15,
            }}
            transition={{
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {/* SUB HEADING LABEL */}

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
                  font-extrabold
                  uppercase
                  tracking-[0.18em]
                  text-[#FF7A00]
                "
              >
                Dholera Property Investment
              </span>
            </div>

            {/* SUB HEADING */}

            <h2
              className="
                mt-5
                text-3xl
                font-extrabold
                leading-tight
                tracking-tight
                text-[#081A3A]

                sm:text-4xl
                md:text-[44px]
              "
            >
              Dholera Smart City{" "}

              <span className="text-[#FF7A00]">
                Properties
              </span>
            </h2>

            {/* ANIMATED LINE */}

            <motion.div
              initial={{
                width: 0,
              }}
              whileInView={{
                width: 75,
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

            {/* DESCRIPTION */}

            <motion.p
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
              transition={{
                duration: 0.6,
                delay: 0.15,
              }}
              className="
                mt-6
                max-w-3xl
                text-[16px]
                leading-8
                text-gray-600

                sm:text-[17px]
                md:text-lg
              "
            >
              Building dreams, one home at a time.
              Discover premium residential, SCO and
              commercial plots in India&apos;s first smart
              city with excellent investment opportunities
              and world-class infrastructure.
            </motion.p>

            {/* =================================================
                INFO CARDS
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
                  y: -4,
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
                    h-10
                    w-10
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

              {/* INVESTMENT */}

              <motion.div
                whileHover={{
                  y: -4,
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
                    h-10
                    w-10
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
                    From ₹44 Lakhs
                  </p>
                </div>
              </motion.div>
            </motion.div>

            {/* =================================================
                SMALL ACCENT ANIMATION
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
                  width: [35, 85, 35],
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
          </motion.div>

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
              overflow-hidden
              rounded-[28px]
              border
              border-[#FF7A00]/15
              bg-linear-to-b
              from-[#FFF8F2]
              to-[#FFEAD8]
              p-7
              shadow-[0_20px_55px_rgba(8,26,58,0.10)]

              md:p-8
            "
          >
            {/* TOP ORANGE LINE */}

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
                font-extrabold
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
                tracking-tight
                text-[#081A3A]

                md:text-[36px]
              "
            >
              From{" "}

              <span className="text-[#FF7A00]">
                ₹44 Lakhs
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
              Premium residential, SCO and commercial
              plots in one of India&apos;s emerging smart
              city investment destinations.
            </p>

            {/* DIVIDER */}

            <div className="my-6 h-px bg-[#FF7A00]/15" />

            {/* FEATURES */}

            <div className="space-y-3">
              {[
                "Dholera Smart City",
                "TP4B2, Bhangadh",
                "Residential & SCO Plots",
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
                    delay: 0.2 + index * 0.1,
                    duration: 0.4,
                  }}
                  whileHover={{
                    x: 4,
                  }}
                  className="
                    group
                    flex
                    items-center
                    gap-3
                    rounded-xl
                    p-2
                    transition-colors
                    duration-300

                    hover:bg-white/70
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
                        transition-transform
                        duration-300

                        group-hover:scale-150
                      "
                    />
                  </span>

                  <span
                    className="
                      text-sm
                      font-semibold
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