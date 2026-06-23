import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FAQJsonLd } from "@/components/seo/FAQJsonLd";
import { ProductJsonLd } from "@/components/seo/ProductJsonLd";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";

const planPrices = {
  free: "0€",
  souvenir: "9,90€",
  eternal: "39,90€",
};

export default async function LandingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dictionary = getDictionary(lang);
  const isEnglish = lang === "en";
  const otherLang: Locale = isEnglish ? "fr" : "en";

  const features = isEnglish
    ? [
        ["Custom memory map", "Pin the places that shaped your relationship, travels or family story."],
        ["Digital photo keepsake", "Add emotional text, dates and photos depending on the selected plan."],
        ["QR Code memory map", "Share a stable link or premium QR Code for instant access."],
      ]
    : [
        ["Carte souvenir personnalisée", "Épinglez les lieux qui ont marqué votre couple, vos voyages ou votre famille."],
        ["Tableau connecté photos souvenirs", "Ajoutez textes, dates et photos selon la formule choisie."],
        ["QR Code souvenir", "Partagez un lien stable ou un QR Code premium accessible instantanément."],
      ];

  const steps = isEnglish
    ? ["Choose your plan and language", "Add meaningful places", "Share the final map by link or QR Code"]
    : ["Choisissez la formule et la langue", "Ajoutez vos lieux importants", "Partagez la carte par lien ou QR Code"];

  const faqs = isEnglish
    ? [
        ["What is a custom memory map?", "It is an interactive keepsake map combining places, dates, messages and optional media."],
        ["Is MyInstants a unique anniversary gift idea?", "Yes, it is designed for couples, families and travelers looking for a personal emotional gift."],
        ["Can I add videos?", "Videos are available on the Eternal plan."],
        ["Are public maps indexed by Google?", "No. Personal memory maps are configured as noindex by default."],
      ]
    : [
        ["Qu’est-ce qu’une carte souvenir personnalisée ?", "C’est une carte interactive qui réunit lieux, dates, messages et médias selon votre formule."],
        ["Est-ce une idée cadeau originale couple ?", "Oui, MyInstants est pensé pour un anniversaire de rencontre, un mariage ou un voyage."],
        ["Puis-je ajouter des vidéos ?", "Les vidéos sont disponibles avec la formule Éternel."],
        ["Les cartes personnelles sont-elles indexées ?", "Non. Les cartes souvenir publiques sont en noindex par défaut."],
      ];

  return (
    <main className="site-shell">
      <ProductJsonLd lang={lang} />
      <FAQJsonLd lang={lang} />
      <section className="landing-hero">
        <nav className="nav-bar" aria-label="Main navigation">
          <Link href={`/${lang}`} className="brand-mark">
            <span className="brand-dot" aria-hidden="true" />
            <span>{dictionary.brand.name}</span>
          </Link>
          <div className="lang-switch" aria-label="Language selector">
            <Link href={`/${otherLang}`}>{otherLang.toUpperCase()}</Link>
            <Link href={`/${lang}/create`}>{dictionary.navigation.create}</Link>
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy-block animate-rise">
            <span className="eyebrow">{dictionary.landing.eyebrow}</span>
            <h1 className="hero-title">{dictionary.landing.hero_title}</h1>
            <p className="hero-copy">{dictionary.landing.hero_copy}</p>
            <div className="hero-actions animate-rise-delayed">
              <Link className="btn-cta" href={`/${lang}/create`}>
                {dictionary.landing.primary_cta}
              </Link>
              <a className="btn-secondary" href="#pricing">
                {dictionary.landing.secondary_cta}
              </a>
            </div>
          </div>
          <div className="memory-card-preview animate-float-in" aria-label={dictionary.navigation.preview}>
            <Image
              className="hero-preview-image"
              src="/images/memory-map-preview.svg"
              alt={
                isEnglish
                  ? "Premium interactive memory map preview"
                  : "Aperçu premium d'une carte souvenir interactive"
              }
              width={760}
              height={760}
              priority
            />
            <div className="preview-map-lines" />
            <article className="floating-memory popup-animated">
              <p className="popup-date">12.05.2024</p>
              <h3>{isEnglish ? "Where it began" : "Là où tout a commencé"}</h3>
              <p>{isEnglish ? "A private story mapped into a living gift." : "Une histoire privée transformée en cadeau vivant."}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{dictionary.landing.emotional_title}</h2>
        <p className="section-copy">{dictionary.landing.emotional_copy}</p>
        <div className="story-showcase">
          <div className="showcase-image-card showcase-image-card-large">
            <Image
              src="/images/couple-keepsake.svg"
              alt={
                isEnglish
                  ? "Couple discovering a digital photo keepsake"
                  : "Couple découvrant un tableau connecté de souvenirs"
              }
              width={920}
              height={620}
            />
          </div>
          <div className="showcase-caption popup-animated">
            <p className="popup-date">{isEnglish ? "Live preview" : "Aperçu vivant"}</p>
            <h3>{isEnglish ? "More than a link: a moment to open" : "Plus qu'un lien : un moment à ouvrir"}</h3>
            <p>
              {isEnglish
                ? "A soft animated reveal, premium cards and emotional map markers make the recipient feel the gift instantly."
                : "Une ouverture animée, des cartes premium et des marqueurs émotionnels donnent immédiatement l'impression d'un vrai cadeau."}
            </p>
          </div>
        </div>
        <div className="feature-grid">
          {features.map(([title, copy]) => (
            <article className="surface-card" key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{dictionary.landing.how_title}</h2>
        <div className="steps-grid">
          {steps.map((step, index) => (
            <article className="surface-card" key={step}>
              <h3>{String(index + 1).padStart(2, "0")}</h3>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{dictionary.landing.map_title}</h2>
        <p className="section-copy">
          {isEnglish
            ? "Use MyInstants as an interactive travel map, personalized relationship map or virtual emotional gift for a milestone."
            : "Utilisez MyInstants comme carte interactive voyage, carte de couple personnalisée ou cadeau virtuel personnalisé pour une grande étape."}
        </p>
      </section>

      <section className="section" id="pricing">
        <h2 className="section-title">{dictionary.landing.pricing_title}</h2>
        <div className="pricing-grid">
          {(["free", "souvenir", "eternal"] as const).map((plan) => (
            <article className={`pricing-card ${plan === "eternal" ? "featured" : ""}`} key={plan}>
              <h3>{dictionary.plans[plan]}</h3>
              <p className="price">{planPrices[plan]}</p>
              <ul>
                <li>{plan === "free" ? "3" : plan === "souvenir" ? "10" : "∞"} {isEnglish ? "points" : "points"}</li>
                <li>{plan === "free" ? (isEnglish ? "No media" : "Aucun média") : plan === "souvenir" ? (isEnglish ? "Photos" : "Photos") : (isEnglish ? "Photos and videos" : "Photos et vidéos")}</li>
                <li>{plan === "free" ? "14 jours" : plan === "souvenir" ? "6 mois" : (isEnglish ? "Lifetime" : "À vie")}</li>
              </ul>
              <Link className="btn-cta" href={`/${lang}/create?plan=${plan}`}>
                {dictionary.cta.start}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{dictionary.landing.faq_title}</h2>
        <div className="faq-grid">
          {faqs.map(([question, answer]) => (
            <article className="faq-card" key={question}>
              <h3>{question}</h3>
              <p>{answer}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">© 2026 MyInstants. {dictionary.brand.tagline}.</footer>
    </main>
  );
}
