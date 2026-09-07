import type { Metadata } from "next";

import AboutUsView from "./AboutUsView";

export const metadata: Metadata = {
  title: "About Omana Projects | Dholera Smart City Developers",
  description:
    "Learn about Omana Projects — our team, approach and track record helping investors navigate residential & SCO plot opportunities in Dholera SIR.",
  alternates: {
    canonical: "/about-us",
  },
};

export default function Page() {
  return <AboutUsView />;
}
