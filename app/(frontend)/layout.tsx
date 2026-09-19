import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dholeraresidentialplot.com"),
  title: "Residential And SCO Plots In Dholera | TP4B2 Bhangadh | Omana Projects",
  description:
    "Explore Residential, SCO, commercial Plots in Dholera Smart City at TP4B2, Bhangadh — near Tata Semiconductor plant And Metro. Talk to Omana Projects",
  verification: {
    google: "cKLtmMkJ9c0y_sqsScNCzUajpEsvz5v9VcPlTxd9Xc4",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col"
      >
        {/* Google tag (gtag.js) */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-LF465NBQ68"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-LF465NBQ68');
          `}
        </Script>

        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
