"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

type HistoryItem = {
  id: string;
  title: string;
  message: string;
  plan: string;
  lang: string;
  created_at: string | null;
  expires_at: string | null;
  points_count: number;
  url: string;
};

function copyFor(lang: Locale) {
  if (lang === "ar") {
    return {
      title: "ذكرياتك النشطة",
      description: "أدخل بريدك الإلكتروني ورمز الحساب السري لعرض روابط PinStory التي ما زالت صالحة.",
      email: "البريد الإلكتروني",
      secret: "رمز الحساب السري",
      placeholder: "user@example.com",
      secretPlaceholder: "الرمز الذي اخترته عند إنشاء حسابك",
      submit: "عرض الذكريات",
      empty: "لا توجد ذكريات نشطة لهذا البريد الإلكتروني.",
      open: "فتح",
      copy: "نسخ الرابط",
      copied: "تم النسخ",
      expires: "تنتهي في",
      lifetime: "مدى الحياة",
      points: "نقاط",
    };
  }

  if (lang === "en") {
    return {
      title: "Your active memories",
      description: "Enter your email and account secret code to see PinStory links that are still valid.",
      email: "Email",
      secret: "Account secret code",
      placeholder: "user@example.com",
      secretPlaceholder: "The code you chose when creating your account",
      submit: "Show memories",
      empty: "No active memories found for this email.",
      open: "Open",
      copy: "Copy link",
      copied: "Copied",
      expires: "Expires on",
      lifetime: "Lifetime",
      points: "points",
    };
  }

  return {
    title: "Vos souvenirs actifs",
    description: "Entrez votre email et le code secret du compte pour retrouver vos liens PinStory encore valides.",
    email: "Email",
    secret: "Code secret du compte",
    placeholder: "user@example.com",
    secretPlaceholder: "Le code choisi lors de la création du compte",
    submit: "Voir mes souvenirs",
    empty: "Aucun souvenir actif trouvé pour cet email.",
    open: "Ouvrir",
    copy: "Copier le lien",
    copied: "Copié",
    expires: "Expire le",
    lifetime: "À vie",
    points: "points",
  };
}

export function HistoryLookup({ lang }: { lang: Locale }) {
  const t = copyFor(lang);
  const [email, setEmail] = useState("");
  const [accountSecret, setAccountSecret] = useState("");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadHistory() {
    setStatus(null);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/history?email=${encodeURIComponent(email.trim())}&account_secret=${encodeURIComponent(accountSecret.trim())}`);
      const payload = (await response.json()) as { maps?: HistoryItem[]; error?: string };

      if (!response.ok) {
        setStatus(payload.error || "Unable to load history.");
        setItems([]);
        return;
      }

      setItems(payload.maps || []);
      if (!payload.maps?.length) setStatus(t.empty);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load history.");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function copyLink(item: HistoryItem) {
    await navigator.clipboard.writeText(item.url);
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId(null), 1400);
  }

  return (
    <section className="history-panel">
      <div>
        <h1 className="section-title">{t.title}</h1>
        <p className="section-copy">{t.description}</p>
      </div>

      <div className="history-form history-form-large">
        <label className="form-field" htmlFor="history-email">
          <span>{t.email}</span>
          <input
            id="history-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t.placeholder}
            autoComplete="email"
          />
        </label>
        <label className="form-field" htmlFor="history-secret">
          <span>{t.secret}</span>
          <input
            id="history-secret"
            type="password"
            value={accountSecret}
            onChange={(event) => setAccountSecret(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadHistory();
            }}
            placeholder={t.secretPlaceholder}
            autoComplete="current-password"
          />
        </label>
        <button className="btn-cta" type="button" onClick={() => void loadHistory()} disabled={isLoading || !email.includes("@") || accountSecret.trim().length < 4}>
          {isLoading ? "..." : t.submit}
        </button>
      </div>

      {status ? <p className="section-copy" role="status">{status}</p> : null}

      <div className="history-grid">
        {items.map((item) => (
          <article className="history-card" key={item.id}>
            <p className="popup-date">{item.plan.toUpperCase()} · {item.points_count} {t.points}</p>
            <h2>{item.title}</h2>
            {item.message ? <p>{item.message}</p> : null}
            <p className="field-hint">
              {item.expires_at ? `${t.expires} ${new Date(item.expires_at).toLocaleDateString(lang)}` : t.lifetime}
            </p>
            <div className="hero-actions">
              <Link className="btn-cta" href={`/map/${item.id}`}>{t.open}</Link>
              <button className="btn-secondary" type="button" onClick={() => void copyLink(item)}>
                {copiedId === item.id ? t.copied : t.copy}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
