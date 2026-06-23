"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type ConsentChoice = "accepted" | "declined";

const copy = {
  fr: {
    title: "MyInstants respecte votre vie privée",
    description:
      "Nous utilisons des cookies essentiels pour sécuriser vos paiements avec Stripe et améliorer votre expérience sur la carte.",
    decline: "Refuser",
    accept: "Accepter",
    iconLabel: "Cookies",
  },
  en: {
    title: "MyInstants respects your privacy",
    description:
      "We use essential cookies to secure Stripe payments and improve your experience on the interactive map.",
    decline: "Decline",
    accept: "Accept",
    iconLabel: "Cookies",
  },
};

export function CookieBanner() {
  const pathname = usePathname();
  const locale = pathname?.startsWith("/en") ? "en" : "fr";
  const dictionary = copy[locale];
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const hasChoice = window.localStorage.getItem("cookie_consent");
    if (hasChoice) return;

    const frame = window.requestAnimationFrame(() => setShowBanner(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function handleConsent(choice: ConsentChoice) {
    window.localStorage.setItem("cookie_consent", choice);
    setShowBanner(false);

    window.dispatchEvent(
      new CustomEvent("myinstants:cookie-consent", {
        detail: { choice },
      }),
    );
  }

  if (!showBanner) return null;

  return (
    <aside className="cookie-banner" aria-label={dictionary.title} role="dialog" aria-live="polite">
      <div className="cookie-content">
        <span className="cookie-icon" aria-label={dictionary.iconLabel} role="img">
          🍪
        </span>
        <div>
          <h2>{dictionary.title}</h2>
          <p>{dictionary.description}</p>
        </div>
      </div>
      <div className="cookie-actions">
        <button className="cookie-button cookie-button-muted" type="button" onClick={() => handleConsent("declined")}>
          {dictionary.decline}
        </button>
        <button className="cookie-button cookie-button-primary" type="button" onClick={() => handleConsent("accepted")}>
          {dictionary.accept}
        </button>
      </div>
    </aside>
  );
}
