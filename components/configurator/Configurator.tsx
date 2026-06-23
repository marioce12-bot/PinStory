"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { LiveMapPreview } from "@/components/configurator/LiveMapPreview";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { getFirebaseClientAuth, googleProvider } from "@/lib/firebase-client";
import type { Locale } from "@/lib/i18n";
import { PLAN_LIMITS, type Plan, type ThemeStyle } from "@/lib/plans";
import type { MemoryPoint } from "@/lib/types";

type Dictionary = typeof import("@/dictionaries/fr.json");

const defaultPoint = (order: number, lang: Locale): MemoryPoint => ({
  id: crypto.randomUUID(),
  order,
  title: order === 1 ? (lang === "en" ? "The first memory" : "Le premier souvenir") : `${lang === "en" ? "Memory" : "Souvenir"} ${order}`,
  date: "2024-05-12",
  description: lang === "en" ? "A short sentence about this moment." : "Une petite phrase sur ce moment.",
  place_name: order === 1 ? "Tour Eiffel, Paris" : "Paris, France",
  location_query: order === 1 ? "Tour Eiffel, Paris" : "Paris, France",
  longitude: 2.2945 + order * 0.01,
  latitude: 48.8584 + order * 0.01,
});

type GeocodingFeature = {
  place_name?: string;
  center?: [number, number];
};

const MAX_UPLOAD_IMAGE_SIZE = 1280;
const IMAGE_COMPRESSION_QUALITY = 0.68;
const UPLOAD_TIMEOUT_MS = 45000;

async function compressImageForUpload(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  // Small images are already cheap to send; avoid unnecessary canvas work.
  if (file.size < 500_000) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, MAX_UPLOAD_IMAGE_SIZE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * ratio);
    const height = Math.round(bitmap.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", IMAGE_COMPRESSION_QUALITY);
    });

    if (!blob || blob.size >= file.size) return file;

    const safeName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${safeName}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

function uploadWithProgress(
  formData: FormData,
  onProgress: (percent: number) => void,
) {
  return new Promise<{ media_url?: string; media_type?: "image" | "video"; error?: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const timeout = window.setTimeout(() => {
      request.abort();
      reject(new Error("Upload timeout"));
    }, UPLOAD_TIMEOUT_MS);

    request.open("POST", "/api/upload");

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      window.clearTimeout(timeout);
      try {
        const payload = JSON.parse(request.responseText || "{}") as { media_url?: string; media_type?: "image" | "video"; error?: string };

        if (request.status >= 200 && request.status < 300) {
          resolve(payload);
          return;
        }

        reject(new Error(payload.error || "Upload failed"));
      } catch {
        reject(new Error("Invalid upload response"));
      }
    };

    request.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("Network upload error"));
    };

    request.onabort = () => {
      window.clearTimeout(timeout);
      reject(new Error("Upload cancelled"));
    };

    request.send(formData);
  });
}

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
  const [creatorEmail, setCreatorEmail] = useState("");
  const [showIdentityGate, setShowIdentityGate] = useState(false);
  const [secretCode, setSecretCode] = useState("");
  const [title, setTitle] = useState(lang === "en" ? "Our story" : "Notre histoire");
  const [message, setMessage] = useState(lang === "en" ? "A living map of us." : "Une carte vivante de nous.");
  const [points, setPoints] = useState<MemoryPoint[]>([defaultPoint(1, lang)]);
  const [activePointId, setActivePointId] = useState(points[0].id);
  const [status, setStatus] = useState<string | null>(null);
  const [uploadingPointId, setUploadingPointId] = useState<string | null>(null);

  const limits = PLAN_LIMITS[plan];
  const availableThemes = limits.themes as readonly ThemeStyle[];
  const activePoint = points.find((point) => point.id === activePointId) || points[0];

  function updatePlan(nextPlan: Plan) {
    setPlan(nextPlan);
    const nextThemes = PLAN_LIMITS[nextPlan].themes as readonly ThemeStyle[];
    if (!nextThemes.includes(theme)) setTheme(nextThemes[0]);
    setPoints((current) =>
      current.slice(0, PLAN_LIMITS[nextPlan].maxPoints).map((point) =>
        PLAN_LIMITS[nextPlan].media
          ? point
          : {
              ...point,
              media_url: undefined,
              media_type: undefined,
            },
      ),
    );
  }

  function updatePoint(id: string, patch: Partial<MemoryPoint>) {
    setPoints((current) => current.map((point) => (point.id === id ? { ...point, ...patch } : point)));
  }

  function addPoint() {
    if (points.length >= limits.maxPoints) return;
    const nextPoint = defaultPoint(points.length + 1, lang);
    setPoints((current) => [...current, nextPoint]);
    setActivePointId(nextPoint.id);
  }

  function removePoint(id: string) {
    setPoints((current) => {
      const nextPoints = current.filter((point) => point.id !== id).map((point, index) => ({ ...point, order: index + 1 }));
      if (!nextPoints.some((point) => point.id === activePointId)) setActivePointId(nextPoints[0]?.id || "");
      return nextPoints;
    });
  }

  async function searchPlace(point: MemoryPoint) {
    setStatus(null);
    const query = point.location_query?.trim() || point.place_name.trim();
    if (!query) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      updatePoint(point.id, { place_name: query, location_query: query });
      setStatus(lang === "en" ? "Mapbox is not configured yet. The place text was saved." : "Mapbox n’est pas encore configuré. Le lieu saisi a été sauvegardé.");
      return;
    }

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&language=${memoryLang}&limit=1`,
    );
    const result = (await response.json()) as { features?: GeocodingFeature[] };
    const feature = result.features?.[0];

    if (!feature?.center) {
      setStatus(lang === "en" ? "No place found. Try a city, address or landmark." : "Aucun lieu trouvé. Essayez une ville, une adresse ou un monument.");
      return;
    }

    updatePoint(point.id, {
      place_name: feature.place_name || query,
      location_query: query,
      longitude: feature.center[0],
      latitude: feature.center[1],
    });
  }

  function selectCurrentPosition(point: MemoryPoint) {
    setStatus(null);

    if (!navigator.geolocation) {
      setStatus(lang === "en" ? "Geolocation is not available on this device." : "La géolocalisation n’est pas disponible sur cet appareil.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updatePoint(point.id, {
          place_name: lang === "en" ? "Current position" : "Position actuelle",
          location_query: lang === "en" ? "Current position" : "Position actuelle",
          longitude: Number(position.coords.longitude.toFixed(5)),
          latitude: Number(position.coords.latitude.toFixed(5)),
        });
      },
      () => setStatus(lang === "en" ? "Unable to access your position." : "Impossible d’accéder à votre position."),
    );
  }

  function pickLocationFromPreview(longitude: number, latitude: number, label: string) {
    if (!activePoint) return;
    updatePoint(activePoint.id, {
      place_name: lang === "en" ? "Selected on the map" : label,
      location_query: lang === "en" ? "Selected on the map" : label,
      longitude,
      latitude,
    });
  }

  async function uploadMedia(point: MemoryPoint, file: File | undefined) {
    if (!file) return;
    if (!limits.media) {
      setStatus(lang === "en" ? "Media is available from the Souvenir plan." : "Les médias sont disponibles à partir de la formule Souvenir.");
      return;
    }
    if (file.type.startsWith("video/") && !limits.videos) {
      setStatus(lang === "en" ? "Videos require the Eternal plan." : "Les vidéos nécessitent la formule Éternel.");
      return;
    }

    try {
      setUploadingPointId(point.id);
      setStatus(lang === "en" ? "Optimizing your photo..." : "Optimisation de votre photo...");

      const fileToUpload = file.type.startsWith("image/") ? await compressImageForUpload(file) : file;
      setStatus(lang === "en" ? "Upload starting..." : "Démarrage de l’upload...");

      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("plan", plan);

      const result = await uploadWithProgress(formData, (percent) => {
        setStatus(lang === "en" ? `Uploading your memory... ${percent}%` : `Upload de votre souvenir... ${percent}%`);
      });

      if (!result.media_url) {
        setStatus(result.error || (lang === "en" ? "Upload failed." : "L’upload a échoué."));
        return;
      }

      updatePoint(point.id, { media_url: result.media_url, media_type: result.media_type });
      setStatus(lang === "en" ? "Photo added." : "Photo ajoutée.");
      window.setTimeout(() => setStatus(null), 1400);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setStatus(
        lang === "en"
          ? `${message}. Try a smaller photo or check Cloudinary settings.`
          : `${message}. Essayez une photo plus légère ou vérifiez Cloudinary.`,
      );
    } finally {
      setUploadingPointId(null);
    }
  }

  async function submit(identityEmail = creatorEmail) {
    setStatus(null);
    if (!identityEmail) {
      setShowIdentityGate(true);
      return;
    }

    const response = await fetch("/api/maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_email: identityEmail || email,
        lang: memoryLang,
        plan,
        theme_style: theme,
        title,
        message,
        secret_code: secretCode,
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

  async function continueWithGoogle() {
    setStatus(null);
    const auth = getFirebaseClientAuth();
    if (!auth) {
      setStatus(lang === "en" ? "Google login is not configured yet." : "La connexion Google n’est pas encore configurée.");
      return;
    }

    const credential = await signInWithPopup(auth, googleProvider);
    const nextEmail = credential.user.email || email;
    setCreatorEmail(nextEmail);
    setEmail(nextEmail);
    setShowIdentityGate(false);
    await submit(nextEmail);
  }

  function continueWithEmail() {
    if (!email) {
      setStatus(lang === "en" ? "Enter your email first." : "Entrez d’abord votre email.");
      return;
    }

    setCreatorEmail(email);
    setShowIdentityGate(false);
    void submit(email);
  }

  return (
    <main className="configurator-layout">
      <section className="configurator-sidebar" aria-label="Map configurator">
        <div className="form-stack">
          <BrandLogo href={`/${lang}`} />
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
            {creatorEmail ? (
              <small className="field-hint">{lang === "en" ? `Connected as ${creatorEmail}` : `Connecté avec ${creatorEmail}`}</small>
            ) : null}
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
            <label htmlFor="secret-code">{lang === "en" ? "Secret code (optional)" : "Code secret (optionnel)"}</label>
            <input
              id="secret-code"
              value={secretCode}
              onChange={(event) => setSecretCode(event.target.value)}
              placeholder={lang === "en" ? "Example: 2405" : "Exemple : 2405"}
            />
            <small className="field-hint">
              {lang === "en"
                ? "If you add one, visitors must type it before seeing the album from the link or QR Code."
                : "Si vous en ajoutez un, les visiteurs devront le saisir avant de voir l’album depuis le lien ou le QR Code."}
            </small>
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
            <h2>{lang === "en" ? "Memories" : "Souvenirs"}</h2>
            <p className="section-copy" style={{ marginBottom: "1rem" }}>
              {points.length}/{Number.isFinite(limits.maxPoints) ? limits.maxPoints : "∞"} {lang === "en" ? "memories used" : "souvenirs utilisés"}
            </p>
            {points.map((point) => (
              <article className={`poi-card-item ${activePointId === point.id ? "active" : ""}`} key={point.id} onFocus={() => setActivePointId(point.id)}>
                <div className="form-stack">
                  <button className="segment-button" type="button" onClick={() => setActivePointId(point.id)}>
                    {lang === "en" ? "Edit this memory" : "Modifier ce souvenir"} #{point.order}
                  </button>

                  <div className="form-field">
                    <label>{lang === "en" ? "Photo or video" : "Photo ou vidéo"}</label>
                    {point.media_url ? (
                      <div className="media-preview-card">
                        {point.media_type === "video" ? (
                          <video src={point.media_url} controls />
                        ) : (
                          <Image src={point.media_url} alt={point.title || point.place_name} width={420} height={260} />
                        )}
                      </div>
                    ) : null}
                    <input type="file" accept={limits.videos ? "image/*,video/*" : "image/*"} disabled={!limits.media} onChange={(event) => uploadMedia(point, event.target.files?.[0])} />
                    <small className="field-hint">
                      {limits.media
                        ? uploadingPointId === point.id
                          ? lang === "en"
                            ? "Uploading..."
                            : "Upload en cours..."
                          : limits.videos
                            ? lang === "en"
                              ? "Upload one image or video for this memory."
                              : "Ajoutez une image ou une vidéo pour ce souvenir."
                            : lang === "en"
                              ? "Upload one photo for this memory."
                              : "Ajoutez une photo pour ce souvenir."
                        : lang === "en"
                          ? "Media is disabled on the Free preview."
                          : "Les médias sont désactivés sur l’aperçu gratuit."}
                    </small>
                  </div>

                  <div className="form-field">
                    <label>{lang === "en" ? "Place" : "Lieu"}</label>
                    <div className="place-search-row">
                      <input
                        value={point.location_query || point.place_name}
                        onChange={(event) => updatePoint(point.id, { location_query: event.target.value, place_name: event.target.value })}
                        placeholder={lang === "en" ? "Eiffel Tower, Paris, hotel name..." : "Tour Eiffel, Paris, nom d'hôtel..."}
                      />
                      <button className="btn-secondary" type="button" onClick={() => searchPlace(point)}>
                        {lang === "en" ? "Find" : "Trouver"}
                      </button>
                    </div>
                    <small className="field-hint">
                      {lang === "en"
                        ? "No coordinates to type. Search, click the preview map, or use your current position."
                        : "Aucune coordonnée à saisir. Cherchez, cliquez sur l’aperçu ou utilisez votre position."}
                    </small>
                  </div>

                  <div className="poi-actions">
                    <button className="btn-secondary" type="button" onClick={() => selectCurrentPosition(point)}>
                      {lang === "en" ? "Use my position" : "Utiliser ma position"}
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => removePoint(point.id)} disabled={points.length === 1}>
                      {lang === "en" ? "Remove" : "Retirer"}
                    </button>
                  </div>

                  <div className="form-field">
                    <label>{lang === "en" ? "Title" : "Titre"}</label>
                    <input value={point.title} onChange={(event) => updatePoint(point.id, { title: event.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Date</label>
                    <input type="date" value={point.date || ""} onChange={(event) => updatePoint(point.id, { date: event.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Description</label>
                    <textarea rows={2} value={point.description} onChange={(event) => updatePoint(point.id, { description: event.target.value })} />
                  </div>
                </div>
              </article>
            ))}
            <button className="btn-secondary" type="button" onClick={addPoint} disabled={points.length >= limits.maxPoints}>
              {lang === "en" ? "Add a memory" : "Ajouter un souvenir"}
            </button>
          </div>

          {status ? (
            <p role="alert" className="section-copy">
              {status}
            </p>
          ) : null}
          <button className="btn-cta" type="button" onClick={() => void submit()} disabled={isPending || !email || !title || points.length === 0}>
            {plan === "free" ? dictionary.cta.save : dictionary.cta.checkout}
          </button>
        </div>
      </section>

      <aside className="configurator-preview" aria-label={dictionary.navigation.preview}>
        <LiveMapPreview title={title} message={message} points={points} theme={theme} onPickLocation={pickLocationFromPreview} />
      </aside>

      {showIdentityGate ? (
        <div className="identity-modal-backdrop" role="dialog" aria-modal="true" aria-label={lang === "en" ? "Continue" : "Continuer"}>
          <div className="identity-modal">
            <BrandLogo href={`/${lang}`} />
            <h2>{lang === "en" ? "Save your album" : "Sauvegarder votre album"}</h2>
            <p>
              {lang === "en"
                ? "Continue with Google or email to save your memories. No password required."
                : "Continuez avec Google ou email pour sauvegarder vos souvenirs. Aucun mot de passe requis."}
            </p>
            <button className="btn-cta" type="button" onClick={continueWithGoogle}>
              {lang === "en" ? "Continue with Google" : "Continuer avec Google"}
            </button>
            <button className="btn-secondary" type="button" onClick={continueWithEmail}>
              {lang === "en" ? "Continue with email" : "Continuer avec email"}
            </button>
            <button className="cookie-button cookie-button-muted" type="button" onClick={() => setShowIdentityGate(false)}>
              {lang === "en" ? "Cancel" : "Annuler"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
