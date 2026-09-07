import type { Metadata } from "next";

import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import FeaturedProperties from "@/components/FeaturedProperties";
import PropertyBanner from "@/components/PropertyBanner";
import CTASection from "@/components/CTASection";

import Footer from "@/components/Footer";

export const metadata: Metadata = {
  alternates: {
    canonical: "/properties",
  },
};

export default function PropertiesPage() {
  return (
    <>
        <TopBar />
        
        <Header />

        <PropertyBanner title="Properties" />

        <FeaturedProperties />
        
         <CTASection/>

         <Footer />

    </>

  );
}