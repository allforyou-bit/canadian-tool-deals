import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://canadian-tool-deals.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Canadian Tool Deals — Compare Tool Prices Across 6 Canadian Stores",
    template: "%s | Canadian Tool Deals",
  },
  description: "Compare prices on Milwaukee, DeWalt, Makita, Ryobi and 30+ brands across Canadian Tire, Home Depot Canada, Walmart CA, Amazon CA, RONA & Princess Auto. Find the cheapest price instantly.",
  keywords: "canadian tool deals, tool price comparison canada, canadian tire tools, home depot canada tools, milwaukee tools canada, dewalt canada price, makita canada, ryobi canada, best tool deals canada",
  authors: [{ name: "Canadian Tool Deals" }],
  creator: "Canadian Tool Deals",
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: SITE_URL,
    siteName: "Canadian Tool Deals",
    title: "Canadian Tool Deals — Compare Prices Across 6 Stores",
    description: "Find the cheapest price on tools in Canada. Compare Canadian Tire, Home Depot, Walmart, Amazon, RONA & Princess Auto instantly.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Canadian Tool Deals — Price Comparison",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Canadian Tool Deals — Compare Prices Across 6 Stores",
    description: "Find the cheapest price on tools in Canada instantly.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-CA" className="h-full">
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
