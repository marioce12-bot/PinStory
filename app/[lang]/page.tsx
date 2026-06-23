import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FAQJsonLd } from "@/components/seo/FAQJsonLd";
import { ProductJsonLd } from "@/components/seo/ProductJsonLd";
import { ScrollReveal } from "@/components/shared/ScrollReveal";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";

const planPrices = {
  free: "0€",
  souvenir: "9,90€",
  eternal: "39,90€",
};

const landingImages = {
  hero:
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
  couple:
    "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1100&q=85",
  travel:
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=85",
  family:
    "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=900&q=85",
  joy:
    "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=900&q=85",
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
      <ScrollReveal />
      <ProductJsonLd lang={lang} />
      <FAQJsonLd lang={lang} />
      <section className="landing-hero">
        <nav className="nav-bar" aria-label="Main navigation">
          <Link href={`/${lang}`} className="brand-mark">
            <Image
              className="brand-logo"
              src="/images/myinstants-logo.jpeg"
              alt="MyInstants logo"
              width={44}
              height={44}
              priority
            />
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
              src={landingImages.hero}
              alt={
                isEnglish
                  ? "Joyful travel memory captured as an interactive map"
                  : "Souvenir de voyage joyeux transformé en carte interactive"
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

      <section className="section" data-reveal="fade-up">
        <h2 className="section-title" data-reveal="slide-left">{dictionary.landing.emotional_title}</h2>
        <p className="section-copy" data-reveal="slide-left">{dictionary.landing.emotional_copy}</p>
        <div className="story-showcase" data-reveal="fade-up">
          <div className="showcase-image-card showcase-image-card-large" data-reveal="slide-left">
            <Image
              src={landingImages.couple}
              alt={
                isEnglish
                  ? "Happy couple keeping a relationship memory"
                  : "Couple heureux conservant un souvenir de relation"
              }
              width={920}
              height={620}
            />
          </div>
          <div className="showcase-caption popup-animated" data-reveal="slide-right">
            <p className="popup-date">{isEnglish ? "Live preview" : "Aperçu vivant"}</p>
            <h3>{isEnglish ? "More than a link: a moment to open" : "Plus qu'un lien : un moment à ouvrir"}</h3>
            <p>
              {isEnglish
                ? "A soft animated reveal, premium cards and emotional map markers make the recipient feel the gift instantly."
                : "Une ouverture animée, des cartes premium et des marqueurs émotionnels donnent immédiatement l'impression d'un vrai cadeau."}
            </p>
          </div>
        </div>
        <div className="photo-story-grid" aria-label={isEnglish ? "Memory photo examples" : "Exemples de photos souvenirs"}>
          <article className="photo-story-card" data-reveal="slide-left">
            <Image src={landingImages.travel} alt={isEnglish ? "Friends enjoying a travel memory" : "Amis profitant d'un souvenir de voyage"} width={620} height={460} />
            <span>{isEnglish ? "Travel" : "Voyage"}</span>
          </article>
          <article className="photo-story-card tall" data-reveal="fade-up">
            <Image src={landingImages.family} alt={isEnglish ? "Family joy captured as a keepsake" : "Joie familiale capturée comme souvenir"} width={620} height={640} />
            <span>{isEnglish ? "Family" : "Famille"}</span>
          </article>
          <article className="photo-story-card" data-reveal="slide-right">
            <Image src={landingImages.joy} alt={isEnglish ? "Shared joyful celebration memory" : "Souvenir joyeux d'une célébration partagée"} width={620} height={460} />
            <span>{isEnglish ? "Joy" : "Joie"}</span>
          </article>
        </div>
        <div className="feature-grid">
          {features.map(([title, copy], index) => (
            <article className="surface-card" key={title} data-reveal={index % 2 === 0 ? "slide-left" : "slide-right"}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" data-reveal="fade-up">
        <h2 className="section-title" data-reveal="slide-left">{dictionary.landing.how_title}</h2>
        <div className="steps-grid">
          {steps.map((step, index) => (
            <article className="surface-card step-card" key={step} data-reveal={index === 1 ? "fade-up" : index === 0 ? "slide-left" : "slide-right"}>
              <h3>{String(index + 1).padStart(2, "0")}</h3>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section visual-band" data-reveal="fade-up">
        <div data-reveal="slide-left">
          <h2 className="section-title">{dictionary.landing.map_title}</h2>
          <p className="section-copy">
          {isEnglish
            ? "Use MyInstants as an interactive travel map, personalized relationship map or virtual emotional gift for a milestone."
            : "Utilisez MyInstants comme carte interactive voyage, carte de couple personnalisée ou cadeau virtuel personnalisé pour une grande étape."}
          </p>
        </div>
        <div className="route-preview-card" data-reveal="slide-right">
          <Image src={landingImages.travel} alt={isEnglish ? "Interactive travel map souvenir" : "Carte interactive de souvenir de voyage"} width={720} height={520} />
          <div className="route-overlay-card">
            <strong>{isEnglish ? "Get Directions" : "S'y rendre"}</strong>
            <span>{isEnglish ? "Open the route from the memory" : "Ouvrir l'itinéraire depuis le souvenir"}</span>
          </div>
        </div>
      </section>

      <section className="section" id="pricing" data-reveal="fade-up">
        <h2 className="section-title" data-reveal="slide-left">{dictionary.landing.pricing_title}</h2>
        <div className="pricing-grid">
          {(["free", "souvenir", "eternal"] as const).map((plan, index) => (
            <article className={`pricing-card ${plan === "eternal" ? "featured" : ""}`} key={plan} data-reveal={index === 0 ? "slide-left" : index === 1 ? "fade-up" : "slide-right"}>
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

      <section className="section" data-reveal="fade-up">
        <h2 className="section-title" data-reveal="slide-left">{dictionary.landing.faq_title}</h2>
        <div className="faq-grid">
          {faqs.map(([question, answer], index) => (
            <article className="faq-card" key={question} data-reveal={index % 2 === 0 ? "slide-left" : "slide-right"}>
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
