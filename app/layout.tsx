import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canadian Tool Deals — Compare Tool Prices Across Canadian Stores",
  description: "Compare tool prices across Canadian Tire, Home Depot Canada, Walmart CA, Amazon CA, RONA, and Princess Auto. Find the best deals on Milwaukee, DeWalt, Makita and more.",
  keywords: "canadian tool deals, tool price comparison canada, canadian tire tools, home depot canada tools, milwaukee tools canada, dewalt canada price",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
