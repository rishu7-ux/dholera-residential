"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { FaStar } from "react-icons/fa";

/* =========================================================
   TESTIMONIAL DATA
========================================================= */

const testimonials = [
  {
    id: 1,
    name: "Sudha Sharma",
    image: "/images/neha Gupta.jpeg",
    review:
      "Dholera Real Estate impressed me with their transparency and professionalism. From the first enquiry to final registration, they handled everything smoothly. I secured a great deal on a residential plot and would highly recommend them.",
  },
  {
    id: 2,
    name: "Rajeev Malhotra",
    image: "/images/rajeev.jpeg",
    review:
      "I am very satisfied with their services. Dholera Real Estate provided excellent support and guidance throughout the process. I got a very good deal on residential plots, and their professionalism and transparency made the experience smooth and stress-free.",
  },
  {
    id: 3,
    name: "Amit Verma",
    image: "/images/amitgupta.jpeg",
    review:
      "My experience with the team was very positive. They explained the available plot options clearly and helped me understand the location, documentation and overall buying process. Their transparent approach gave me confidence while choosing a property in Dholera.",
  },
  {
    id: 4,
    name: "Neha Gupta",
    image: "/images/sudha sharma.jpeg",
    review:
      "The team provided excellent guidance throughout my property search in Dholera. They were responsive, professional and clear about every step of the process. I especially appreciated their support with documentation and property-related information.",
  },

{
    id: 5,
    name: " ankit gupta",
    image: "/images/ankit gupta.jpeg",
    review:
      "The team provided excellent guidance throughout my property search in Dholera. They were responsive, professional and clear about every step of the process. I especially appreciated their support with documentation and property-related information.",
  },


];


/* =========================================================
   DUPLICATE FOR CONTINUOUS RUNNING
========================================================= */

const runningTestimonials = [
  ...testimonials,
  ...testimonials,
];

/* =========================================================
   COMPONENT
========================================================= */

export default function Testimonial() {
  return (
    <section
      className="
        relative
        overflow-hidden
        bg-[#FFF9F4]
        py-16
        sm:py-20
      "
    >
      {/* =====================================================
          HEADING
      ===================================================== */}

      <div
        className="
          mx-auto
          max-w-7xl
          px-4
          sm:px-6
          lg:px-8
        "
      >
        <div className="mb-10 sm:mb-14">
          <p
            className="
              text-[10px]
              font-bold
              uppercase
              tracking-[0.22em]
              text-[#FF7A00]
              sm:text-xs
            "
          >
            Client Experiences
          </p>

          <h2
            className="
              mt-3
              text-[30px]
              font-black
              uppercase
              leading-tight
              text-[#2D241F]

              sm:text-4xl
              md:text-5xl
            "
          >
            OUR{" "}
            <span className="text-[#FF7A00]">
              TESTIMONIALS
            </span>
          </h2>

          <p
            className="
              mt-4
              max-w-3xl
              text-[14px]
              leading-7
              text-gray-600

              sm:text-base
              sm:leading-8
            "
          >
            See what our clients say about their experience while
            exploring property opportunities in Dholera.
          </p>

          {/* ORANGE DOTS */}

          <div className="mt-5 flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((item) => (
              <span
                key={item}
                className="
                  h-2
                  w-2
                  rounded-full
                  bg-[#FF7A00]
                "
              />
            ))}
          </div>
        </div>
      </div>

      {/* =====================================================
          SLIDER / RUNNING CARDS
      ===================================================== */}

      <div
        className="
          relative
          w-full
          overflow-hidden
          py-2
        "
      >
        {/* LEFT FADE */}

        <div
          className="
            pointer-events-none
            absolute
            left-0
            top-0
            z-20
            h-full
            w-4

            bg-linear-to-r
            from-[#FFF9F4]
            to-transparent

            sm:w-10
            lg:w-16
          "
        />

        {/* RIGHT FADE */}

        <div
          className="
            pointer-events-none
            absolute
            right-0
            top-0
            z-20
            h-full
            w-4

            bg-linear-to-l
            from-[#FFF9F4]
            to-transparent

            sm:w-10
            lg:w-16
          "
        />

        {/* ===================================================
            MOVING TRACK
        =================================================== */}

        <motion.div
          className="
            flex
            w-max
            items-stretch
            gap-5
            px-4

            sm:gap-6
            sm:px-6

            lg:gap-7
            lg:px-8
          "
          animate={{
            x: ["0%", "-50%"],
          }}
          transition={{
            duration: 50,
            ease: "linear",
            repeat: Infinity,
          }}
        >
          {runningTestimonials.map((item, index) => (
            <article
              key={`${item.id}-${index}`}
              className="
                group

                relative
                isolate

                flex
                min-h-82.5

                w-77.5
                shrink-0
                flex-col

                overflow-hidden

                rounded-[22px]

                border
                border-[#FF7A00]/20

                bg-white

                p-5

                shadow-[0_8px_28px_rgba(66,38,18,0.06)]

                transition-all
                duration-500
                ease-out

                hover:-translate-y-1
                hover:border-[#E86600]
                hover:shadow-[0_16px_35px_rgba(255,122,0,0.18)]

                sm:min-h-87.5
                sm:w-97.5
                sm:p-7

                lg:w-125
                lg:p-8
              "
            >
              {/* ===============================================
                  DARK ORANGE HOVER BACKGROUND
              =============================================== */}

              <div
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  -z-10

                  bg-linear-to-br
                  from-[#FF7A00]
                  via-[#F26F00]
                  to-[#D85E00]

                  opacity-0

                  transition-opacity
                  duration-500

                  group-hover:opacity-100
                "
              />

              {/* ===============================================
                  INTERNAL DECORATION
              =============================================== */}

              <div
                className="
                  pointer-events-none

                  absolute
                  -right-14
                  -top-14
                  -z-10

                  h-40
                  w-40

                  rounded-full
                  bg-white/10

                  opacity-0

                  transition-all
                  duration-500

                  group-hover:scale-125
                  group-hover:opacity-100
                "
              />

              {/* ===============================================
                  STAR RATING
              =============================================== */}

              <div
                className="
                  relative
                  z-10

                  flex
                  items-center
                  gap-1

                  text-[#FF7A00]

                  transition-colors
                  duration-500

                  group-hover:text-white
                "
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <FaStar
                    key={star}
                    className="
                      text-[12px]

                      transition-all
                      duration-300

                      group-hover:scale-110

                      sm:text-sm
                    "
                  />
                ))}
              </div>

              {/* ===============================================
                  REVIEW
              =============================================== */}

              <p
                className="
                  relative
                  z-10

                  mt-5

                  text-[13px]
                  leading-7

                  text-gray-600

                  transition-colors
                  duration-500

                  group-hover:text-white

                  sm:text-[15px]
                  sm:leading-8
                "
              >
                {item.review}
              </p>

              {/* ===============================================
                  CLIENT DETAILS
              =============================================== */}

              <div
                className="
                  relative
                  z-10

                  mt-auto
                  pt-6
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-4

                    border-t
                    border-[#FF7A00]/10

                    pt-5

                    transition-colors
                    duration-500

                    group-hover:border-white/25
                  "
                >
                  {/* CLIENT IMAGE */}

                  <div
                    className="
                      relative

                      h-16
                      w-16

                      shrink-0

                      overflow-hidden

                      rounded-full

                      border-[3px]
                      border-[#FF7A00]

                      bg-[#FFF4E8]

                      shadow-[0_5px_15px_rgba(255,122,0,0.14)]

                      transition-all
                      duration-500

                      group-hover:scale-105
                      group-hover:border-white
                      group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)]

                      sm:h-18
                      sm:w-18
                    "
                  >
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="72px"
                      className="
                        object-cover
                        transition-transform
                        duration-700
                        group-hover:scale-110
                      "
                    />
                  </div>

                  {/* NAME */}

                  <div>
                    <h4
                      className="
                        text-[18px]
                        font-bold
                        text-[#2D241F]

                        transition-colors
                        duration-500

                        group-hover:text-white

                        sm:text-xl
                      "
                    >
                      {item.name}
                    </h4>

                    <p
                      className="
                        mt-1

                        text-[11px]
                        font-medium
                        uppercase
                        tracking-[0.1em]

                        text-gray-500

                        transition-colors
                        duration-500

                        group-hover:text-white/75

                        sm:text-xs
                      "
                    >
                      Happy Client
                    </p>
                  </div>
                </div>
              </div>

              {/* ===============================================
                  BOTTOM HOVER LINE
              =============================================== */}

              <div
                className="
                  pointer-events-none

                  absolute
                  bottom-0
                  left-0

                  h-[4px]
                  w-0

                  bg-white

                  transition-all
                  duration-500

                  group-hover:w-full
                "
              />
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}