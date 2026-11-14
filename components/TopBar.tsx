"use client";

import Link from "next/link";

import {
  FaPhoneAlt,
  FaEnvelope,
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaWhatsapp,
} from "react-icons/fa";

export default function TopBar() {
  /* =========================================================
     SOCIAL LINKS
  ========================================================= */

  const socialLinks = [
    {
      icon: <FaFacebookF />,
      href: "https://www.facebook.com/share/14nw1ZfSqB3/?mibextid=wwXIfr",
      label: "Facebook",
    },
    {
      icon: <FaInstagram />,
      href: "https://www.instagram.com/omana_projects?igsh=MTgydG1ib2xxMjA2cg%3D%3D&igsi=MTgydG1ib2xxMjA2cg%3D%3D&utm_source=qr",
      label: "Instagram",
    },
    {
      icon: <FaYoutube />,
      href: "https://www.youtube.com/@omanaprojects",
      label: "YouTube",
    },
    {
      icon: <FaWhatsapp />,
      href: "https://wa.me/919217104219",
      label: "WhatsApp",
    },
  ];

  return (
    <div
      className="
        relative
        hidden
        w-full
        overflow-hidden
        bg-[#FFF4E8]
        text-[#2D241F]
        shadow-[0_3px_12px_rgba(255,122,0,0.05)]
        md:block
      "
    >
      {/* =====================================================
          LIGHT BACKGROUND EFFECT
      ===================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          -left-20
          -top-20
          h-36
          w-36
          rounded-full
          bg-[#FF7A00]/8
          blur-3xl
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -bottom-20
          -right-20
          h-36
          w-36
          rounded-full
          bg-[#FFB46B]/15
          blur-3xl
        "
      />

      {/* =====================================================
          MAIN CONTAINER
      ===================================================== */}

      <div
        className="
          relative
          z-10
          flex
          w-full
          items-center
          justify-between

          px-6
          py-1.5

          lg:px-10
          xl:px-14
          2xl:px-20
        "
      >
        {/* =====================================================
            LEFT SIDE
        ===================================================== */}

        <div className="flex items-center gap-5">
          {/* ===================================================
              PHONE
          =================================================== */}

          <a
            href="tel:+919217104219"
            aria-label="Call +91 92171 04219"
            className="
              group
              flex
              cursor-pointer
              items-center
              gap-2
            "
          >
            {/* PHONE ICON */}

            <span
              className="
                flex
                h-7
                w-7
                shrink-0
                items-center
                justify-center

                rounded-[7px]

                bg-[#FF7A00]
                text-white

                shadow-[0_3px_8px_rgba(255,122,0,0.16)]

                transition-all
                duration-300
                ease-out

                group-hover:-translate-y-px
                group-hover:scale-105
                group-hover:bg-[#E96F00]
                group-hover:shadow-[0_5px_12px_rgba(255,122,0,0.25)]

                group-active:scale-95
              "
            >
              <FaPhoneAlt className="text-[10px]" />
            </span>

            {/* PHONE NUMBER */}

            <span
              className="
                whitespace-nowrap

                text-[13px]
                font-semibold

                text-[#51453D]

                transition-colors
                duration-300

                group-hover:text-[#FF7A00]

                lg:text-sm
              "
            >
              +91 92171 04219
            </span>
          </a>

          {/* ===================================================
              DIVIDER
          =================================================== */}

          <div
            className="
              h-5
              w-px
              bg-[#FF7A00]/20
            "
          />

          {/* ===================================================
              EMAIL
          =================================================== */}

          <a
            href="mailto:customercare@omanaprojects.com"
            aria-label="Email Omana Projects"
            className="
              group
              flex
              cursor-pointer
              items-center
              gap-2
            "
          >
            {/* EMAIL ICON */}

            <span
              className="
                flex
                h-7
                w-7
                shrink-0
                items-center
                justify-center

                rounded-[7px]

                bg-[#FF7A00]
                text-white

                shadow-[0_3px_8px_rgba(255,122,0,0.16)]

                transition-all
                duration-300
                ease-out

                group-hover:-translate-y-px
                group-hover:scale-105
                group-hover:bg-[#E96F00]
                group-hover:shadow-[0_5px_12px_rgba(255,122,0,0.25)]

                group-active:scale-95
              "
            >
              <FaEnvelope className="text-[10px]" />
            </span>

            {/* EMAIL TEXT */}

            <span
              className="
                whitespace-nowrap

                text-[13px]
                font-semibold

                text-[#51453D]

                transition-colors
                duration-300

                group-hover:text-[#FF7A00]

                lg:text-sm
              "
            >
              customercare@omanaprojects.com
            </span>
          </a>
        </div>

        {/* =====================================================
            RIGHT SIDE
        ===================================================== */}

        <div
          className="
            flex
            items-center
            gap-2
          "
        >
          {/* ===================================================
              FOLLOW US
          =================================================== */}

          <span
            className="
              mr-2
              whitespace-nowrap

              text-[9px]
              font-bold
              uppercase
              tracking-[0.20em]

              text-[#8A6F5D]

              lg:text-[10px]
            "
          >
            Follow Us
          </span>

          {/* ===================================================
              SOCIAL MEDIA ICONS
          =================================================== */}

          {socialLinks.map((social) => (
            <Link
              key={social.label}
              href={social.href}
              aria-label={social.label}
              title={social.label}
              target="_blank"
              rel="noopener noreferrer"
              className="
                flex
                h-7
                w-7
                shrink-0
                items-center
                justify-center

                rounded-[7px]

                bg-[#FF7A00]

                text-[10px]
                text-white

                shadow-[0_3px_8px_rgba(255,122,0,0.16)]

                transition-all
                duration-300
                ease-out

                hover:-translate-y-px
                hover:scale-105
                hover:bg-[#E96F00]
                hover:shadow-[0_5px_12px_rgba(255,122,0,0.25)]

                active:scale-95
              "
            >
              {social.icon}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}