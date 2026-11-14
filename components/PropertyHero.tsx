"use client";

import Image from "next/image";
import { FaMapMarkerAlt, FaRoad } from "react-icons/fa";
import { MdOutlineVilla } from "react-icons/md";
import { FaRulerCombined } from "react-icons/fa";

export default function PropertyHero() {
  return (
    <section className="relative bg-[#f7f7f7]">
      <div className="relative h-112.5 w-full overflow-hidden">

        <div className="grid h-full grid-cols-3">

          <div className="relative">
            <Image
              src="/images/ridhi872-1.jpg"
              alt=""
              fill
              className="object-cover"
            />
          </div>

          <div className="relative">
            <Image
              src="/images/ridhi872-2.jpg"
              alt=""
              fill
              className="object-cover"
            />
          </div>

          <div className="relative">
            <Image
              src="/images/ridhi872-3.jpg"
              alt=""
              fill
              className="object-cover"
            />
          </div>

        </div>

        <div className="absolute inset-0 bg-[#081A3A]/40" />

        <div className="absolute bottom-8 left-1/2 w-full max-w-6xl -translate-x-1/2 px-6">

          <div className="rounded-lg bg-white p-8 shadow-2xl">

            <div className="flex flex-col justify-between gap-8 lg:flex-row">

              <div>

                <h1 className="text-4xl font-bold text-[#FF7A00]">
                  Ridhi 872/1 Mixed Use Land
                </h1>

                <div className="mt-3 flex items-center gap-2 text-gray-600">
                  <FaMapMarkerAlt className="text-[#FF7A00]" />
                  Bhangadh, Dholera
                </div>

              </div>

              <div className="text-right">

                <p className="text-2xl font-bold text-[#FF7A00]">
                  Starting Price
                </p>

                <p className="text-4xl font-bold">
                  ₹44 Lakhs
                </p>

              </div>

            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">

              <div className="flex items-center gap-2 rounded bg-[#FFF7EA] p-3">

                <FaRulerCombined className="text-[#FF7A00]" />

                <span>398-521 Sq.Yd.</span>

              </div>

              <div className="flex items-center gap-2 rounded bg-[#FFF7EA] p-3">

                <MdOutlineVilla className="text-[#FF7A00]" />

                <span>TP-4,4B-2</span>

              </div>

              <div className="flex items-center gap-2 rounded bg-[#FFF7EA] p-3">

                <FaRoad className="text-[#FF7A00]" />

                <span>FP Road 70 Mtr</span>

              </div>

              <div className="flex items-center justify-center rounded bg-[#FF7A00] p-3 text-white">

                Total Area 20,587 mtr

              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}