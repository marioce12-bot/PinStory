import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { CookieBanner } from "@/components/shared/CookieBanner";
import "./globals.css";

const inter = Inter({
  variable: "--font-main",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.myinstantsmap.com"),
  title: "MyInstants",
  description: "Create personalized interactive memory maps with QR Codes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
