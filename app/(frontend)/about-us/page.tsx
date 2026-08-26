"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import {
  FaArrowRight,
  FaBuilding,
  FaCheck,
  FaChartLine,
  FaFileAlt,
  FaHandshake,
  FaHome,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaShieldAlt,
} from "react-icons/fa";

import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import PopupForm from "@/components/PopupForm";

/* =========================================================
   ABOUT IMAGE
========================================================= */

const aboutImage = "/images/about-as-service-contact-information-concept.jpg";

/* =========================================================
   SERVICES
========================================================= */

const services = [
  {
    icon: FaHome,
    title: "Residential Plot Sales",
    description:
      "Residential plot sales in Dholera SIR with property guidance and project information.",
  },
  {
    icon: FaChartLine,
    title: "Investment Consulting",
    description:
      "Investment consulting for smart city properties based on location, budget and long-term objectives.",
  },
  {
    icon: FaFileAlt,
    title: "Legal Support",
    description:
      "Legal verification and documentation support to help buyers understand property paperwork.",
  },
  {
    icon: FaMapMarkerAlt,
    title: "Site Visit",
    description:
      "Site visit coordination for customers interested in exploring Dholera properties personally.",
  },
  {
    icon: FaBuilding,
    title: "Location Analysis",
    description:
      "Plot location analysis and future growth insights for different development zones.",
  },
];

/* =========================================================
   JOURNEY
========================================================= */

const journeyExpansion = [
  {
    icon: FaChartLine,
    title: "Property Investment Consulting",
    description:
      "Professional guidance for customers considering real estate investment opportunities in Dholera.",
  },
  {
    icon: FaBuilding,
    title: "Customized Land Solutions",
    description:
      "Property options based on investment goals, location preferences and available budget.",
  },
  {
    icon: FaHandshake,
    title: "Investor Support Services",
    description:
      "Support throughout property exploration, documentation and investment decision-making.",
  },
];

/* =========================================================
   ANIMATION VARIANTS
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

const stagger = {
  hidden: {},

  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardAnimation = {
  hidden: {
    opacity: 0,
    y: 30,
    scale: 0.97,
  },

  visible: {
    opacity: 1,
    y: 0,
    scale: 1,

    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

/* =========================================================
   SECTION HEADING
========================================================= */

function SectionHeading({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{
        once: true,
        amount: 0.2,
      }}
      className="mb-8"
    >
      {/* LABEL */}

      <div className="mb-4 flex items-center gap-3">
        <span className="h-0.5 w-9 rounded-full bg-[#FF7A00]" />

        <span className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#FF7A00]">
          {label}
        </span>
      </div>

      {/* TITLE */}

      <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-[#081A3A] md:text-4xl lg:text-[42px]">
        {title}
      </h2>

      {/* DESCRIPTION */}

      {description && (
        <p className="mt-4 max-w-3xl text-[16px] leading-8 text-gray-600">
          {description}
        </p>
      )}
    </motion.div>
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
          PREMIUM ORANGE HERO
      ===================================================== */}

      <section className="relative overflow-hidden bg-[#FF7A00]">
        {/* DECORATION */}

        <div className="pointer-events-none absolute -right-24 -top-32 h-105 w-105 rotate-12 border-60 border-white/10" />

        <div className="pointer-events-none absolute right-[18%] top-10 h-48 w-48 rotate-45 border-25 border-white/5" />

        <div className="relative mx-auto flex min-h-58.75 max-w-7xl items-center px-5 py-10 sm:px-6 lg:px-8">
          <motion.div
            initial={{
              opacity: 0,
              y: 30,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="max-w-4xl"
          >
            {/* LABEL */}

            <div className="mb-4 flex items-center gap-3">
              <span className="h-0.5 w-10 bg-white" />

              <span className="text-xs font-bold uppercase tracking-[0.24em] text-white">
                Omana Projects
              </span>
            </div>

            {/* HEADING */}

            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[54px]">
              About Us
            </h1>

            {/* BREADCRUMB */}

            <div className="mt-5 flex items-center gap-2 text-sm font-medium text-white/90">
              <Link
                href="/"
                className="transition-colors duration-300 hover:text-[#081A3A]"
              >
                Home
              </Link>

              <span>/</span>

              <span>About Us</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =====================================================
          SINGLE ABOUT IMAGE
      ===================================================== */}

      <section className="relative bg-white py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="
              relative
              overflow-hidden
              rounded-[28px]
              border
              border-[#FF7A00]/10
              bg-[#F8FAFC]
              shadow-[0_25px_70px_rgba(8,26,58,0.13)]
            "
          >
            <div
              className="
                relative
                h-65
                overflow-hidden
                sm:h-95
                md:h-115
                lg:h-130
              "
            >
              <Image
                src={aboutImage}
                alt="Dholera Residential Plot"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 1200px"
                className="
                  object-cover
                  object-center
                  transition-transform
                  duration-1000
                  hover:scale-[1.02]
                "
              />

              <div
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  bg-linear-to-t
                  from-[#081A3A]/35
                  via-transparent
                  to-transparent
                "
              />

              <div
                className="
                  absolute
                  bottom-4
                  left-4
                  rounded-xl
                  border
                  border-white/20
                  bg-[#081A3A]/55
                  px-4
                  py-3
                  text-white
                  backdrop-blur-md
                  sm:bottom-6
                  sm:left-6
                  sm:px-5
                "
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFB067] sm:text-xs">
                  Dholera Smart City
                </p>

                <p className="mt-1 text-sm font-bold sm:text-base">
                  Residential &amp; Investment Opportunities
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =====================================================
          COMPANY HISTORY
      ===================================================== */}

      <section className="relative overflow-hidden bg-[#FAFAFA] py-20">
        {/* BACKGROUND DECORATION */}

        <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-[#FF7A00]/5 blur-3xl" />

        <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-[#081A3A]/5 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_360px]">
            {/* =================================================
                LEFT CONTENT
            ================================================= */}

            <main>
              <SectionHeading
                label="Our Story"
                title="Our Company History"
                description="Building trust through verified property opportunities, transparent guidance and customer-focused real estate services."
              />

              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{
                  once: true,
                }}
                className="
                  rounded-[26px]
                  border
                  border-[#FF7A00]/10
                  bg-white
                  p-6
                  shadow-[0_15px_45px_rgba(8,26,58,0.06)]
                  md:p-8
                "
              >
                <p className="text-[16px] leading-8 text-gray-700 md:text-[17px]">
                  Omana Projects launched Dholera Residential Plot in 2024, and
                  the idea behind it was pretty straightforward — buying land in
                  a place like Dholera Smart City shouldn&apos;t feel like a gamble.
                  Between verifying titles, understanding fair pricing, and
                  getting advice you can actually rely on, most investors and
                  first-time homebuyers were left figuring things out on their
                  own. We wanted to change that, offering a place where people
                  could find verified plots and honest, transparent guidance
                  without the usual guesswork.
                </p>

                <div className="my-7 h-px bg-gray-100" />

                <p className="text-[16px] leading-8 text-gray-700 md:text-[17px]">
                  Dholera SIR isn&apos;t your average development. It&apos;s India&apos;s
                  first planned greenfield smart city under the Delhi–Mumbai
                  Industrial Corridor, and that status alone has pulled in
                  investors, developers, and industries from every corner of the
                  country and abroad. Our role in all this is simple: help people
                  cut through the noise and invest with confidence in a region
                  that&apos;s growing faster than most.
                </p>
              </motion.div>

              {/* =================================================
                  WHAT WE DO
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  label="Our Expertise"
                  title="What Does Dholera Residential Plot Do?"
                />

                <p className="text-[17px] leading-8 text-gray-700">
                  Dholera Residential Plot helps investors buy verified
                  residential plots in Dholera with professional guidance.
                </p>

                {/* SERVICES */}

                <motion.div
                  variants={stagger}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{
                    once: true,
                    amount: 0.1,
                  }}
                  className="mt-8 grid gap-5 sm:grid-cols-2"
                >
                  {services.map((service) => {
                    const Icon = service.icon;

                    return (
                      <motion.article
                        key={service.title}
                        variants={cardAnimation}
                        whileHover={{
                          y: -6,
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
                        {/* ICON */}

                        <span
                          className="
                            flex
                            h-12
                            w-12
                            items-center
                            justify-center
                            rounded-xl
                            bg-[#FFF0E2]
                            text-[#FF7A00]
                            transition-all
                            duration-300

                            group-hover:rotate-6
                            group-hover:scale-110
                            group-hover:bg-[#FF7A00]
                            group-hover:text-white
                          "
                        >
                          <Icon />
                        </span>

                        {/* TITLE */}

                        <h3 className="mt-5 text-lg font-extrabold text-[#081A3A] transition-colors duration-300 group-hover:text-[#FF7A00]">
                          {service.title}
                        </h3>

                        {/* DESCRIPTION */}

                        <p className="mt-3 text-sm leading-7 text-gray-600">
                          {service.description}
                        </p>

                        {/* BOTTOM LINE */}

                        <span className="absolute bottom-0 left-0 h-0.75 w-0 bg-[#FF7A00] transition-all duration-500 group-hover:w-full" />
                      </motion.article>
                    );
                  })}
                </motion.div>

                <motion.p
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{
                    once: true,
                  }}
                  className="
                    mt-8
                    rounded-2xl
                    border
                    border-[#FF7A00]/15
                    bg-[#FFF4E8]
                    p-5
                    text-[16px]
                    font-semibold
                    leading-8
                    text-[#081A3A]
                  "
                >
                  We focus on making the property buying process transparent,
                  secure, and profitable.
                </motion.p>
              </section>

              {/* =================================================
                  JOURNEY
              ================================================= */}

              <section className="mt-16">
                <SectionHeading
                  label="Growth Story"
                  title="Our Journey"
                />

                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{
                    once: true,
                  }}
                  className="
                    rounded-[26px]
                    border
                    border-gray-100
                    bg-white
                    p-6
                    shadow-[0_12px_40px_rgba(8,26,58,0.06)]
                    md:p-8
                  "
                >
                  <p className="text-[16px] leading-8 text-gray-700">
                    We didn&apos;t start big. It began with a small handful of
                    residential plots and a lot of relationship-building —
                    getting to know local developers, landowners, and early
                    investors, one conversation at a time. What carried us
                    through that early phase, and what still guides us today, is
                    a commitment to keeping documentation clean, being upfront
                    about every detail, and giving advice people can actually act
                    on. That&apos;s what turned first-time buyers into repeat clients
                    and word-of-mouth referrals.
                  </p>
                </motion.div>

                {/* JOURNEY CARDS */}

                <motion.div
                  variants={stagger}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{
                    once: true,
                    amount: 0.15,
                  }}
                  className="mt-7 grid gap-5 md:grid-cols-3"
                >
                  {journeyExpansion.map((item) => {
                    const Icon = item.icon;

                    return (
                      <motion.article
                        key={item.title}
                        variants={cardAnimation}
                        whileHover={{
                          y: -7,
                        }}
                        className="
                          group
                          rounded-[22px]
                          border
                          border-[#FF7A00]/10
                          bg-white
                          p-6
                          shadow-[0_12px_35px_rgba(8,26,58,0.06)]
                          transition-all
                          duration-300

                          hover:border-[#FF7A00]/25
                          hover:bg-[#FFF7EF]
                          hover:shadow-[0_18px_45px_rgba(255,122,0,0.12)]
                        "
                      >
                        <span
                          className="
                            flex
                            h-12
                            w-12
                            items-center
                            justify-center
                            rounded-xl
                            bg-[#FFF0E2]
                            text-[#FF7A00]
                            transition-all
                            duration-300

                            group-hover:scale-110
                            group-hover:bg-[#FF7A00]
                            group-hover:text-white
                          "
                        >
                          <Icon />
                        </span>

                        <h3 className="mt-5 text-lg font-extrabold text-[#081A3A]">
                          {item.title}
                        </h3>

                        <p className="mt-3 text-sm leading-7 text-gray-600">
                          {item.description}
                        </p>
                      </motion.article>
                    );
                  })}
                </motion.div>

                <p className="mt-7 text-[17px] leading-8 text-gray-700">
                  As trust grew, so did what we offered. We moved beyond just
                  selling plots into property investment consulting, customized
                  land solutions, and dedicated investor support — helping people
                  not just buy land, but actually understand what they were buying
                  and why it made sense. Today, whether someone&apos;s making their
                  very first real estate investment or adding to a portfolio
                  they&apos;ve built over years, they come to us for the same reason:
                  a platform they can trust in a market that moves fast.
                </p>
              </section>

              {/* =================================================
                  VISION
              ================================================= */}

              <motion.section
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
                }}
                transition={{
                  duration: 0.65,
                }}
                className="
                  relative
                  mt-16
                  overflow-hidden
                  rounded-[28px]
                  border
                  border-[#FF7A00]/15
                  bg-[#FFF4E8]
                  p-7
                  md:p-9
                "
              >
                {/* ICON */}

                <div
                  className="
                    flex
                    h-14
                    w-14
                    items-center
                    justify-center
                    rounded-2xl
                    bg-[#FF7A00]
                    text-xl
                    text-white
                    shadow-[0_10px_25px_rgba(255,122,0,0.25)]
                  "
                >
                  <FaShieldAlt />
                </div>

                {/* LABEL */}

                <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-[#FF7A00]">
                  Future Direction
                </p>

                {/* HEADING */}

                <h2 className="mt-3 text-3xl font-extrabold text-[#081A3A] md:text-4xl">
                  Our Vision
                </h2>

                {/* CONTENT */}

                <p className="mt-5 text-[16px] leading-8 text-gray-700">
                  We want to be the name people think of first when it comes to
                  residential, mixed-use &amp; industrial property investment in
                  Dholera Smart City — known for genuine plots, straight answers,
                  and guidance that actually holds up. As Dholera keeps evolving
                  into a global hub for smart infrastructure, manufacturing, and
                  modern urban living, our focus stays the same: making sure the
                  people who invest with us are set up to benefit from that
                  growth, not just today, but for years to come.
                </p>

                {/* CTA */}

                <motion.button
                  type="button"
                  onClick={() => setPopupOpen(true)}
                  whileHover={{
                    y: -3,
                    scale: 1.02,
                  }}
                  whileTap={{
                    scale: 0.98,
                  }}
                  className="
                    group
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
                  Explore Investment Opportunities

                  <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
                </motion.button>
              </motion.section>
            </main>

            {/* =================================================
                SIDEBAR
            ================================================= */}

            <aside className="space-y-7 self-start lg:sticky lg:top-28">
              {/* ENQUIRY CARD */}

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
                {/* TOP LINE */}

                <span className="absolute left-0 top-0 h-1 w-full bg-[#FF7A00]" />

                {/* LABEL */}

                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7A00]">
                  Property Enquiry
                </span>

                {/* TITLE */}

                <h3 className="mt-2 text-3xl font-extrabold text-[#081A3A]">
                  Looking to Invest in Dholera?
                </h3>

                {/* DESCRIPTION */}

                <p className="mt-3 text-sm leading-6 text-gray-600">
                  Speak with our property team for project information,
                  availability, pricing and site-visit assistance.
                </p>

                {/* ENQUIRE */}

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

                {/* PHONE */}

                <a
                  href="tel:+919217104219"
                  className="
                    group
                    mt-5
                    flex
                    items-center
                    justify-center
                    gap-2
                    border-t
                    border-[#FF7A00]/15
                    pt-5
                    text-sm
                    font-bold
                    text-[#081A3A]
                    transition-colors
                    duration-300

                    hover:text-[#FF7A00]
                  "
                >
                  <FaPhoneAlt className="text-[#FF7A00]" />

                  +91 92171 04219
                </a>
              </motion.div>

              {/* =================================================
                  TRUST CARD
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
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7A00]">
                  Why Choose Us
                </p>

                <h3 className="mt-2 text-2xl font-extrabold text-[#081A3A]">
                  Property Guidance You Can Understand
                </h3>

                <div className="mt-6 space-y-3">
                  {[
                    "Property Information",
                    "Investment Guidance",
                    "Documentation Support",
                    "Site Visit Assistance",
                  ].map((item) => (
                    <motion.div
                      key={item}
                      whileHover={{
                        x: 4,
                      }}
                      className="
                        group
                        flex
                        items-center
                        gap-3
                        rounded-xl
                        border
                        border-transparent
                        bg-[#FFF9F4]
                        p-3
                        transition-all
                        duration-300

                        hover:border-[#FF7A00]/15
                        hover:bg-[#FFF0E2]
                      "
                    >
                      <span
                        className="
                          flex
                          h-8
                          w-8
                          items-center
                          justify-center
                          rounded-lg
                          bg-[#FFF0E2]
                          text-xs
                          text-[#FF7A00]
                          transition-all
                          duration-300

                          group-hover:bg-[#FF7A00]
                          group-hover:text-white
                        "
                      >
                        <FaCheck />
                      </span>

                      <span className="text-sm font-semibold text-[#081A3A]">
                        {item}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </aside>
          </div>
        </div>
      </section>

      {/* =====================================================
          CTA
      ===================================================== */}

      <CTASection />

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <Footer />

      {/* =====================================================
          POPUP FORM
      ===================================================== */}

      <PopupForm
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
      />
    </>
  );
}