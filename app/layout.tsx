import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Playfair_Display } from "next/font/google";
import { CookieBanner } from "@/components/shared/CookieBanner";
import { DEFAULT_LOCALE, getDirection, isLocale } from "@/lib/i18n";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.pinstory.app"),
  title: "PinStory",
  description: "Create personalized interactive memory maps with QR Codes.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const requestLocale = requestHeaders.get("x-pinstory-locale") || DEFAULT_LOCALE;
  const locale = isLocale(requestLocale) ? requestLocale : DEFAULT_LOCALE;

  return (
    <html lang={locale} dir={getDirection(locale)} className={`${inter.variable} ${playfair.variable}`}>
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
