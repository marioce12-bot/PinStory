import { NextRequest, NextResponse } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;
const locales = ["fr", "en", "ar"] as const;
const defaultLocale = "en";

function detectLocale(acceptLanguage: string) {
  const languages = acceptLanguage.toLowerCase();
  if (languages.includes("ar")) return "ar";
  if (languages.includes("fr")) return "fr";
  return defaultLocale;
}

function getPathLocale(pathname: string) {
  const segment = pathname.split("/")[1];
  return locales.includes(segment as (typeof locales)[number]) ? segment : defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pinstory-locale", getPathLocale(pathname));

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/map") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (pathname === "/") {
    const acceptLanguage = request.headers.get("accept-language") || "";
    const preferredLang = detectLocale(acceptLanguage);
    return NextResponse.redirect(new URL(`/${preferredLang}`, request.url));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
