"use client";

import Link from "next/link";
import { FaArrowRight } from "react-icons/fa";

export default function CTASection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-r from-[#FF7A00] via-[#FF8C00] to-[#FF7A00]">

      {/* Background Shapes */}

      <div className="absolute inset-0 overflow-hidden">

        <div className="absolute -right-24 top-0 h-full w-105 rotate-12 bg-white/10" />

        <div className="absolute right-60 -top-24 h-75 w-75 rotate-45 bg-white/5" />

        <div className="absolute left-1/2 top-0 h-full w-62.5 skew-x-[-35deg] bg-white/5" />

      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-6 py-12 md:flex-row">

        {/* Left Content */}

        <div>

          <h2 className="text-4xl font-semibold text-white md:text-5xl">
            Looking To Buy Residential Plot?
          </h2>

          <p className="mt-4 max-w-2xl text-lg text-orange-100">
            Connect with Omana Projects today and get the best value for your
            property in Dholera Smart City.
          </p>

        </div>

        {/* Button */}

        <Link
          href="/contact-us"
          className="group inline-flex items-center gap-3 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-[#0A2E73] shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-[#0A2E73] hover:text-white"
        >
          Get in Touch

          <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-2" />

        </Link>

      </div>

    </section>
  );
}