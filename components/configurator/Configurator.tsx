"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { PLAN_LIMITS, type Plan, type ThemeStyle } from "@/lib/plans";
import type { MemoryPoint } from "@/lib/types";
import { LiveMapPreview } from "@/components/configurator/LiveMapPreview";

type Dictionary = typeof import("@/dictionaries/fr.json");

const defaultPoint = (order: number): MemoryPoint => ({
  id: crypto.randomUUID(),
  order,
  title: order === 1 ? "Notre rencontre" : `Souvenir ${order}`,
  date: "2024-05-12",
  description: "Sous la pluie battante près de la fontaine.",
  longitude: 2.3522 + order * 0.01,
  latitude: 48.8566 + order * 0.01,
});

export function Configurator({
  lang,
  dictionary,
  initialPlan,
}: {
  lang: Locale;
  dictionary: Dictionary;
  initialPlan: Plan;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [memoryLang, setMemoryLang] = useState<Locale>(lang);
  const [theme, setTheme] = useState<ThemeStyle>(PLAN_LIMITS[initialPlan].themes[0] as ThemeStyle);
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState(lang === "en" ? "Our story" : "Notre histoire");
  const [message, setMessage] = useState(lang === "en" ? "A living map of us." : "Une carte vivante de nous.");
  const [points, setPoints] = useState<MemoryPoint[]>([defaultPoint(1), defaultPoint(2)]);
  const [status, setStatus] = useState<string | null>(null);

  const limits = PLAN_LIMITS[plan];
  const availableThemes = limits.themes as readonly ThemeStyle[];

  function updatePlan(nextPlan: Plan) {
    setPlan(nextPlan);
    const nextThemes = PLAN_LIMITS[nextPlan].themes as readonly ThemeStyle[];
    if (!nextThemes.includes(theme)) setTheme(nextThemes[0]);
    setPoints((current) => current.slice(0, PLAN_LIMITS[nextPlan].maxPoints));
  }

  function updatePoint(id: string, field: keyof MemoryPoint, value: string) {
    setPoints((current) =>
      current.map((point) =>
        point.id === id
          ? {
              ...point,
              [field]: field === "longitude" || field === "latitude" ? Number(value) : value,
            }
          : point,
      ),
    );
  }

  function addPoint() {
    if (points.length >= limits.maxPoints) return;
    setPoints((current) => [...current, defaultPoint(current.length + 1)]);
  }

  function removePoint(id: string) {
    setPoints((current) => current.filter((point) => point.id !== id).map((point, index) => ({ ...point, order: index + 1 })));
  }

  async function submit() {
    setStatus(null);
    const response = await fetch("/api/maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_email: email,
        lang: memoryLang,
        plan,
        theme_style: theme,
        title,
        message,
        points,
      }),
    });
    const result = (await response.json()) as { id?: string; checkoutUrl?: string; error?: string };

    if (!response.ok) {
      setStatus(result.error || "Unable to save the map.");
      return;
    }

    startTransition(() => {
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
      else router.push(`/map/${result.id}`);
    });
  }

  return (
    <main className="configurator-layout">
      <section className="configurator-sidebar" aria-label="Map configurator">
        <div className="form-stack">
          <a href={`/${lang}`} className="brand-mark">
            <span className="brand-dot" aria-hidden="true" />
            <span>{dictionary.brand.name}</span>
          </a>
          <h1 className="section-title" style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)" }}>
            {lang === "en" ? "Build your memory map" : "Construisez votre carte souvenir"}
          </h1>

          <div className="form-field">
            <label>{lang === "en" ? "Plan" : "Formule"}</label>
            <div className="segmented-grid">
              {(["free", "souvenir", "eternal"] as const).map((item) => (
                <button className={`segment-button ${plan === item ? "active" : ""}`} key={item} onClick={() => updatePlan(item)} type="button">
                  {dictionary.plans[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label>{lang === "en" ? "Final map language" : "Langue du souvenir"}</label>
            <div className="segmented-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {(["fr", "en"] as const).map((item) => (
                <button className={`segment-button ${memoryLang === item ? "active" : ""}`} key={item} onClick={() => setMemoryLang(item)} type="button">
                  {item === "fr" ? "Français" : "English"}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@example.com" />
          </div>

          <div className="form-field">
            <label htmlFor="title">{lang === "en" ? "Map title" : "Titre de la carte"}</label>
            <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="form-field">
            <label htmlFor="message">Message</label>
            <textarea id="message" rows={3} value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>

          <div className="form-field">
            <label htmlFor="theme">Thème</label>
            <select id="theme" value={theme} onChange={(event) => setTheme(event.target.value as ThemeStyle)}>
              {availableThemes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h2>{lang === "en" ? "Memory points" : "Points souvenirs"}</h2>
            <p className="section-copy" style={{ marginBottom: "1rem" }}>
              {points.length}/{Number.isFinite(limits.maxPoints) ? limits.maxPoints : "∞"} {lang === "en" ? "points used" : "points utilisés"}
            </p>
            {points.map((point) => (
              <article className="poi-card-item" key={point.id}>
                <div className="form-stack">
                  <div className="form-field">
                    <label>{lang === "en" ? "Title" : "Titre"}</label>
                    <input value={point.title} onChange={(event) => updatePoint(point.id, "title", event.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Date</label>
                    <input type="date" value={point.date || ""} onChange={(event) => updatePoint(point.id, "date", event.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Description</label>
                    <textarea rows={2} value={point.description} onChange={(event) => updatePoint(point.id, "description", event.target.value)} />
                  </div>
                  <div className="segmented-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div className="form-field">
                      <label>Longitude</label>
                      <input type="number" step="0.0001" value={point.longitude} onChange={(event) => updatePoint(point.id, "longitude", event.target.value)} />
                    </div>
                    <div className="form-field">
                      <label>Latitude</label>
                      <input type="number" step="0.0001" value={point.latitude} onChange={(event) => updatePoint(point.id, "latitude", event.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="poi-actions">
                  <button className="btn-secondary" type="button" onClick={() => removePoint(point.id)} disabled={points.length === 1}>
                    {lang === "en" ? "Remove" : "Retirer"}
                  </button>
                </div>
              </article>
            ))}
            <button className="btn-secondary" type="button" onClick={addPoint} disabled={points.length >= limits.maxPoints}>
              {lang === "en" ? "Add a point" : "Ajouter un point"}
            </button>
          </div>

          {status ? <p role="alert" className="section-copy">{status}</p> : null}
          <button className="btn-cta" type="button" onClick={submit} disabled={isPending || !email || !title || points.length === 0}>
            {plan === "free" ? dictionary.cta.save : dictionary.cta.checkout}
          </button>
        </div>
      </section>

      <aside className="configurator-preview" aria-label={dictionary.navigation.preview}>
        <LiveMapPreview title={title} message={message} points={points} theme={theme} />
      </aside>
    </main>
  );
}
