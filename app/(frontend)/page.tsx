import type { Metadata } from "next";

import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import PropertyIntro from "@/components/PropertyType";
import LookingFor from "@/components/LookingFor";
import Testimonial from "@/components/Testimonial";
import BlogSection from "@/components/BlogSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import PopupForm from "@/components/PopupForm";
import SideEnquiry from "@/components/SideEnquiry";
import AIChatbot from "@/components/AIChatbot";

export const metadata: Metadata = {
  title: "Residential And SCO Plots In Dholera | TP4B2 Bhangadh | Omana Projects",
  description:
    "Explore Residential, SCO, commercial Plots in Dholera Smart City at TP4B2, Bhangadh — near Tata Semiconductor plant And Metro. Talk to Omana Projects",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <>
      {/* TOP BAR */}
      <TopBar />

      {/* HEADER */}
      <Header />

      {/* HERO */}
      <Hero />

      {/* SIDE ENQUIRY */}
      <SideEnquiry />

      {/* POPUP FORM */}
      <PopupForm />

      {/* PROPERTY TYPE */}
      <PropertyIntro />

      {/* LOOKING FOR */}
      <LookingFor />

      {/* TESTIMONIAL */}
      <Testimonial />

      {/* BLOG */}
      <BlogSection />

      {/* CTA */}
      <CTASection />

      {/* FOOTER */}
      <Footer />

      {/* AI CHATBOT */}
      <AIChatbot />
    </>
  );
}
