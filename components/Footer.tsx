"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import {
  FaArrowRight,
  FaEnvelope,
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaWhatsapp,
  FaYoutube,
} from "react-icons/fa";

/* =========================================================
   PROPERTY LINKS
========================================================= */

const propertyLinks = [
  {
    label: "Ridhi 966/1 SCO Plots",
    href: "/properties/ridhi-966-1",
  },
  {
    label: "Ridhi 249/2 Premium SCO",
    href: "/properties/ridhi-249-2",
  },
  {
    label: "Sidhi 857",
    href: "/properties/sidhi-857",
  },
];

/* =========================================================
   QUICK LINKS
========================================================= */

const quickLinks = [
  {
    label: "Properties",
    href: "/properties",
  },
  {
    label: "Blog",
    href: "/blog",
  },
  {
    label: "Contact Us",
    href: "/contact-us",
  },
];

/* =========================================================
   SOCIAL LINKS
========================================================= */

const socialLinks = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/share/14nw1ZfSqB3/?mibextid=wwXIfr",
    icon: <FaFacebookF />,
    bg: "bg-[#1877F2]",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/omana_projects",
    icon: <FaInstagram />,
    bg: "bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCAF45]",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@OmanaProjects",
    icon: <FaYoutube />,
    bg: "bg-[#FF0000]",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/omana-projectss/",
    icon: <FaLinkedinIn />,
    bg: "bg-[#0A66C2]",
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/919217104219",
    icon: <FaWhatsapp />,
    bg: "bg-[#25D366]",
  },
];

/* =========================================================
   ANIMATION
========================================================= */

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 22,
  },

  visible: {
    opacity: 1,
    y: 0,

    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

/* =========================================================
   FOOTER LINK
========================================================= */

function FooterLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="
          group
          inline-flex
          items-center
          gap-2
          text-[12px]
          font-medium
          text-gray-600
          transition-all
          duration-300
          hover:text-[#FF7A00]
          sm:text-[13px]
        "
      >
        <span
          className="
            flex
            h-5
            w-5
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-[#FFF0E2]
            text-[7px]
            text-[#FF7A00]
            transition-all
            duration-300
            group-hover:bg-[#FF7A00]
            group-hover:text-white
          "
        >
          <FaArrowRight />
        </span>

        <span className="transition-transform duration-300 group-hover:translate-x-1">
          {label}
        </span>
      </Link>
    </li>
  );
}

/* =========================================================
   FOOTER
========================================================= */

export default function Footer() {
  return (
    <footer className="overflow-hidden">
      {/* =====================================================
          MAIN FOOTER
      ===================================================== */}

      <section
        className="
          relative
          overflow-hidden
          border-t
          border-[#FF7A00]/10
          bg-[#FFF9F4]
        "
      >
        {/* LEFT BACKGROUND EFFECT */}

        <motion.div
          className="
            pointer-events-none
            absolute
            -left-24
            top-10
            h-64
            w-64
            rounded-full
            bg-[#FF7A00]/6
            blur-3xl
          "
          animate={{
            scale: [1, 1.15, 1],
            x: [0, 20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* RIGHT BACKGROUND EFFECT */}

        <motion.div
          className="
            pointer-events-none
            absolute
            -right-24
            bottom-0
            h-72
            w-72
            rounded-full
            bg-[#FF9638]/7
            blur-3xl
          "
          animate={{
            scale: [1, 1.2, 1],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* MAIN CONTAINER */}

        <div
          className="
            relative
            mx-auto
            max-w-7xl
            px-4
            py-7
            sm:px-6
            sm:py-8
            lg:pl-16
            lg:pr-6
            lg:py-10
            xl:pl-20
            xl:pr-8
          "
        >
          {/* FOOTER GRID */}

          <div
            className="
              grid
              grid-cols-2
              gap-x-4
              gap-y-7
              sm:grid-cols-4
              sm:gap-5
              lg:grid-cols-[1.35fr_1fr_0.8fr_1fr]
              lg:gap-8
              lg:translate-x-3
              xl:translate-x-5
            "
          >
            {/* =================================================
                CONTACT / BRAND
            ================================================= */}

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{
                once: true,
                amount: 0.15,
              }}
            >
              <p
                className="
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.2em]
                  text-[#FF7A00]
                "
              >
                Get In Touch
              </p>

              <h3
                className="
                  mt-1
                  text-[22px]
                  font-extrabold
                  text-[#33261D]
                  sm:text-[21px]
                "
              >
                Omana Projects
              </h3>

              <p
                className="
                  mt-3
                  max-w-sm
                  text-[11px]
                  leading-5
                  text-gray-600
                  sm:text-[12px]
                  sm:leading-6
                "
              >
                Helping investors explore residential, commercial and
                investment opportunities in Dholera.
              </p>

              {/* CONTACT DETAILS */}

              <div className="mt-3.5 space-y-2">
                {/* ADDRESS */}

                <div className="flex items-start gap-3">
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
                      text-[11px]
                      text-[#FF7A00]
                    "
                  >
                    <FaMapMarkerAlt />
                  </span>

                  <p className="text-[10px] leading-4.5 text-gray-600 sm:text-[11px]">
                    7th Floor, Plot No 56A/16, C Block, Phase-2,
                    Sector-62, Noida, Uttar Pradesh - 201309
                  </p>
                </div>

                {/* EMAIL */}

                <Link
                  href="mailto:sales@dholeraresidentialplot.com"
                  className="group flex items-center gap-3"
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
                      text-[11px]
                      text-[#FF7A00]
                      transition-all
                      duration-300
                      group-hover:bg-[#FF7A00]
                      group-hover:text-white
                    "
                  >
                    <FaEnvelope />
                  </span>

                  <span
                    className="
                      break-all
                      text-[10px]
                      text-gray-600
                      transition-colors
                      duration-300
                      group-hover:text-[#FF7A00]
                      sm:text-[11px]
                    "
                  >
                    sales@dholeraresidentialplot.com
                  </span>
                </Link>

                {/* PHONE */}

                <Link
                  href="tel:+919217104219"
                  className="group flex items-center gap-3"
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
                      text-[11px]
                      text-[#FF7A00]
                      transition-all
                      duration-300
                      group-hover:bg-[#FF7A00]
                      group-hover:text-white
                    "
                  >
                    <FaPhoneAlt />
                  </span>

                  <span
                    className="
                      text-[11px]
                      font-semibold
                      text-gray-600
                      transition-colors
                      duration-300
                      group-hover:text-[#FF7A00]
                      sm:text-[12px]
                    "
                  >
                    +91 92171 04219
                  </span>
                </Link>
              </div>
            </motion.div>

            {/* =================================================
                PROPERTIES
            ================================================= */}

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{
                once: true,
                amount: 0.15,
              }}
              transition={{
                delay: 0.05,
              }}
            >
              <p
                className="
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.18em]
                  text-[#FF7A00]
                "
              >
                Explore
              </p>

              <h3
                className="
                  mt-1
                  text-[18px]
                  font-extrabold
                  text-[#33261D]
                "
              >
                Properties
              </h3>

              <div className="mt-2 h-0.5 w-8 rounded-full bg-[#FF7A00]" />

              <ul className="mt-3.5 space-y-2">
                {propertyLinks.map((item) => (
                  <FooterLink
                    key={item.label}
                    href={item.href}
                    label={item.label}
                  />
                ))}
              </ul>
            </motion.div>

            {/* =================================================
                QUICK LINKS
            ================================================= */}

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{
                once: true,
                amount: 0.15,
              }}
              transition={{
                delay: 0.1,
              }}
            >
              <p
                className="
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.18em]
                  text-[#FF7A00]
                "
              >
                Navigation
              </p>

              <h3
                className="
                  mt-1
                  text-[18px]
                  font-extrabold
                  text-[#33261D]
                "
              >
                Quick Links
              </h3>

              <div className="mt-2 h-0.5 w-8 rounded-full bg-[#FF7A00]" />

              <ul className="mt-3.5 space-y-2">
                {quickLinks.map((item) => (
                  <FooterLink
                    key={item.label}
                    href={item.href}
                    label={item.label}
                  />
                ))}
              </ul>
            </motion.div>

            {/* =================================================
                SOCIAL MEDIA
            ================================================= */}

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{
                once: true,
                amount: 0.15,
              }}
              transition={{
                delay: 0.15,
              }}
            >
              <p
                className="
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.18em]
                  text-[#FF7A00]
                "
              >
                Stay Connected
              </p>

              <h3
                className="
                  mt-1
                  text-[18px]
                  font-extrabold
                  text-[#33261D]
                "
              >
                Follow Us
              </h3>

              <div className="mt-2 h-0.5 w-8 rounded-full bg-[#FF7A00]" />

              {/* SOCIAL ICONS */}

              <div
                className="
                  mt-4
                  flex
                  flex-wrap
                  gap-2
                "
              >
                {socialLinks.map((social, index) => (
                  <motion.div
                    key={social.label}
                    initial={{
                      opacity: 0,
                      y: 10,
                      scale: 0.9,
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
                      delay: 0.05 * index,
                      duration: 0.3,
                    }}
                    whileHover={{
                      y: -5,
                      scale: 1.1,
                    }}
                    whileTap={{
                      scale: 0.92,
                    }}
                  >
                    <Link
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      title={social.label}
                      className={`
                        group/social
                        flex
                        h-9
                        w-9
                        items-center
                        justify-center
                        rounded-lg
                        text-[13px]
                        text-white
                        shadow-sm
                        transition-all
                        duration-300
                        hover:shadow-lg
                        ${social.bg}
                      `}
                    >
                      <span
                        className="
                          transition-transform
                          duration-300
                          group-hover/social:scale-110
                        "
                      >
                        {social.icon}
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* 
                  CHAT ON WHATSAPP BUTTON REMOVED
                  WhatsApp social icon above still remains.
              */}
            </motion.div>
          </div>
        </div>
      </section>

      {/* =====================================================
          BOTTOM FOOTER
      ===================================================== */}

      <div
        className="
          border-t
          border-[#FF7A00]/10
          bg-white
        "
      >
        <div
          className="
            mx-auto
            flex
            max-w-7xl
            flex-col
            items-center
            justify-between
            gap-1.5
            px-4
            py-3.5
            text-center
            sm:px-6
            md:flex-row
            md:text-left
            lg:pl-16
            lg:pr-6
            xl:pl-20
            xl:pr-8
          "
        >
          <p className="text-[10px] text-gray-500 sm:text-[11px]">
            © 2026{" "}
            <span className="font-semibold text-[#34261D]">
              Omana Projects
            </span>
            . All Rights Reserved.
          </p>

          <p className="text-[9px] text-gray-400 sm:text-[10px]">
            Dholera Residential &amp; Investment Properties
          </p>
        </div>
      </div>
    </footer>
  );
}