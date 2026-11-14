import type { Metadata } from "next";

import Sidhi857View from "./Sidhi857View";

export const metadata: Metadata = {
  title: "Sidhi 857 Residential Plots | Bhangadh, TP 4-B2, Dholera SIR",
  description:
    "NA-converted residential plots in Bhangadh Village, TP 4-B2, Dholera SIR. 390–450 sq. yd., 48 m main road. Currently sold out.",
  alternates: {
    canonical: "/properties/sidhi-857",
  },
};

export default function Page() {
  return <Sidhi857View />;
}
