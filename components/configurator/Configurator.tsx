"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { AudioSelector } from "@/components/configurator/AudioSelector";
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
  title:
    order === 1
      ? lang === "ar"
        ? "الذكرى الأولى"
        : lang === "en"
          ? "The first memory"
          : "Le premier souvenir"
      : `${lang === "ar" ? "ذكرى" : lang === "en" ? "Memory" : "Souvenir"} ${order}`,
  date: "2024-05-12",
  description: lang === "ar" ? "جملة قصيرة عن هذه اللحظة." : lang === "en" ? "A short sentence about this moment." : "Une petite phrase sur ce moment.",
  place_name: order === 1 ? "Tour Eiffel, Paris" : "Paris, France",
  location_query: order === 1 ? "Tour Eiffel, Paris" : "Paris, France",
  longitude: 2.2945 + order * 0.01,
  latitude: 48.8584 + order * 0.01,
});

type MapTilerFeature = {
  place_name?: string;
  text?: string;
  center?: [number, number];
  geometry?: {
    coordinates?: [number, number];
  };
};

type NominatimPlace = {
  display_name?: string;
  lon?: string;
  lat?: string;
};

const ALL_THEMES = ["minimalist", "pastel", "dark-luxe", "premium-gold"] as const satisfies readonly ThemeStyle[];

const MAX_UPLOAD_IMAGE_SIZE = 1280;
const IMAGE_COMPRESSION_QUALITY = 0.68;
const UPLOAD_TIMEOUT_MS = 45000;

function getStoredValue(key: string) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) || "";
}

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
        reject(new Error(`Invalid upload response (${request.status})`));
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
  const isArabic = lang === "ar";
  const isEnglish = lang === "en";
  const [isPending, startTransition] = useTransition();
  const plan = initialPlan;
  const memoryLang: Locale = lang;
  const [theme, setTheme] = useState<ThemeStyle>(PLAN_LIMITS[initialPlan].themes[0] as ThemeStyle);
  const [email, setEmail] = useState(() => getStoredValue("pinstory_creator_email"));
  const [creatorEmail, setCreatorEmail] = useState(() => getStoredValue("pinstory_creator_email"));
  const [accountSecret, setAccountSecret] = useState(() => getStoredValue("pinstory_account_secret"));
  const [showIdentityGate, setShowIdentityGate] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [secretCode, setSecretCode] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [title, setTitle] = useState(lang === "ar" ? "قصتنا" : lang === "en" ? "Our story" : "Notre histoire");
  const [message, setMessage] = useState(lang === "ar" ? "خريطة حيّة لنا." : lang === "en" ? "A living map of us." : "Une carte vivante de nous.");
  const [finalMessage, setFinalMessage] = useState(
    lang === "ar"
      ? "شكراً لأنك عشت هذه الرحلة معنا. هذه الذكريات ستبقى دائماً قريبة من القلب."
      : lang === "en"
        ? "Thank you for reliving this journey with us. These memories will always stay close to our hearts."
        : "Merci d’avoir revécu ce voyage avec nous. Ces souvenirs resteront toujours près du cœur.",
  );
  const [points, setPoints] = useState<MemoryPoint[]>([defaultPoint(1, lang)]);
  const [activePointId, setActivePointId] = useState(points[0].id);
  const [status, setStatus] = useState<string | null>(null);
  const [uploadingPointId, setUploadingPointId] = useState<string | null>(null);
  const [miniQuota, setMiniQuota] = useState({ quota: 2, remaining: 2, used: 0, knownAccount: false });

  const limits = PLAN_LIMITS[plan];
  const availableThemes = limits.themes as readonly ThemeStyle[];
  const activePoint = points.find((point) => point.id === activePointId) || points[0];

  useEffect(() => {
    if (plan !== "mini") return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      const frame = window.requestAnimationFrame(() => {
        setMiniQuota({ quota: 2, remaining: 2, used: 0, knownAccount: false });
      });

      return () => window.cancelAnimationFrame(frame);
    }

    const controller = new AbortController();

    fetch(`/api/mini-quota?email=${encodeURIComponent(normalizedEmail)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: { quota?: number; remaining?: number; used?: number; knownAccount?: boolean }) => {
        setMiniQuota({
          quota: payload.quota ?? 2,
          remaining: payload.remaining ?? 2,
          used: payload.used ?? 0,
          knownAccount: Boolean(payload.knownAccount),
        });
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
      });

    return () => controller.abort();
  }, [email, plan]);

  function getMiniQuotaText() {
    if (miniQuota.remaining <= 0) {
      return isArabic
        ? "انتهت التجارب المجانية، ستكون هذه الخريطة بسعر 2$"
        : isEnglish
          ? "Free trials used, this Mini map is $2"
          : "Essais gratuits utilisés, cette carte Mini sera à 2$";
    }

    if (miniQuota.remaining === miniQuota.quota && !miniQuota.knownAccount) {
      return isArabic
        ? "مجاناً لأول خريطتين Mini"
        : isEnglish
          ? "Free for your first 2 Mini maps"
          : "Gratuit pour vos 2 premières cartes Mini";
    }

    return isArabic
      ? `مجاناً: تبقى ${miniQuota.remaining} من ${miniQuota.quota}`
      : isEnglish
        ? `Free: ${miniQuota.remaining} of ${miniQuota.quota} left`
        : `Gratuit : il reste ${miniQuota.remaining} sur ${miniQuota.quota}`;
  }

  function getThemeLabel(item: ThemeStyle) {
    switch (item) {
      case "minimalist":
        return isArabic ? "بسيط" : isEnglish ? "Minimalist" : "Minimaliste";
      case "pastel":
        return isArabic ? "باستيل" : "Pastel";
      case "dark-luxe":
        return isArabic ? "فاخر داكن" : isEnglish ? "Dark luxe" : "Sombre luxe";
      case "premium-gold":
        return isArabic ? "ذهبي فاخر" : isEnglish ? "Premium gold" : "Premium doré";
    }
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

    const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;

    try {
      if (mapTilerKey) {
        const response = await fetch(
          `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${mapTilerKey}&language=${memoryLang}&limit=1`,
        );
        const result = (await response.json()) as { features?: MapTilerFeature[] };
        const feature = result.features?.[0];
        const coordinates = feature?.center || feature?.geometry?.coordinates;

        if (coordinates) {
          updatePoint(point.id, {
            place_name: feature?.place_name || feature?.text || query,
            location_query: query,
            longitude: coordinates[0],
            latitude: coordinates[1],
          });
          return;
        }
      }

      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { "Accept-Language": memoryLang } },
      );
      const places = (await nominatimResponse.json()) as NominatimPlace[];
      const place = places[0];

      if (!place?.lat || !place.lon) {
        setStatus(isArabic ? "لم يتم العثور على مكان. جرّب مدينة أو عنواناً أو معلماً." : isEnglish ? "No place found. Try a city, address or landmark." : "Aucun lieu trouvé. Essayez une ville, une adresse ou un monument.");
        return;
      }

      updatePoint(point.id, {
        place_name: place.display_name || query,
        location_query: query,
        longitude: Number(place.lon),
        latitude: Number(place.lat),
      });
    } catch {
      updatePoint(point.id, { place_name: query, location_query: query });
      setStatus(isArabic ? "تم حفظ المكان. يمكنك النقر على المعاينة لتقريب الموقع." : isEnglish ? "Place saved. You can click the preview to refine the position." : "Lieu enregistré. Vous pouvez cliquer sur l’aperçu pour affiner l’emplacement.");
    }
  }

  function selectCurrentPosition(point: MemoryPoint) {
    setStatus(null);

    if (!navigator.geolocation) {
      setStatus(isArabic ? "تحديد الموقع غير متاح على هذا الجهاز." : isEnglish ? "Geolocation is not available on this device." : "La géolocalisation n’est pas disponible sur cet appareil.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updatePoint(point.id, {
          place_name: isArabic ? "الموقع الحالي" : isEnglish ? "Current position" : "Position actuelle",
          location_query: isArabic ? "الموقع الحالي" : isEnglish ? "Current position" : "Position actuelle",
          longitude: Number(position.coords.longitude.toFixed(5)),
          latitude: Number(position.coords.latitude.toFixed(5)),
        });
      },
      () => setStatus(isArabic ? "تعذر الوصول إلى موقعك." : isEnglish ? "Unable to access your position." : "Impossible d’accéder à votre position."),
    );
  }

  function pickLocationFromPreview(longitude: number, latitude: number, label: string) {
    if (!activePoint) return;
    updatePoint(activePoint.id, {
      place_name: isArabic ? "تم التحديد على الخريطة" : isEnglish ? "Selected on the map" : label,
      location_query: isArabic ? "تم التحديد على الخريطة" : isEnglish ? "Selected on the map" : label,
      longitude,
      latitude,
    });
  }

  async function uploadMedia(point: MemoryPoint, file: File | undefined) {
    if (!file) return;
    if (!limits.media) {
      setStatus(isArabic ? "الوسائط متاحة ابتداءً من خطة تذكار." : isEnglish ? "Media is available from the Souvenir plan." : "Les médias sont disponibles à partir de la formule Souvenir.");
      return;
    }
    if (file.type.startsWith("video/") && !limits.videos) {
      setStatus(isArabic ? "الفيديوهات تتطلب خطة أبدي." : isEnglish ? "Videos require the Eternal plan." : "Les vidéos nécessitent la formule Éternel.");
      return;
    }

    try {
      setUploadingPointId(point.id);
      setStatus(isArabic ? "جاري تحسين الصورة..." : isEnglish ? "Optimizing your photo..." : "Optimisation de votre photo...");

      const fileToUpload = file.type.startsWith("image/") ? await compressImageForUpload(file) : file;
      setStatus(isArabic ? "بدء رفع الملف..." : isEnglish ? "Upload starting..." : "Démarrage de l’upload...");

      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("plan", plan);

      const result = await uploadWithProgress(formData, (percent) => {
        setStatus(isArabic ? `جاري رفع الذكرى... ${percent}%` : isEnglish ? `Uploading your memory... ${percent}%` : `Upload de votre souvenir... ${percent}%`);
      });

      if (!result.media_url) {
        setStatus(result.error || (isArabic ? "فشل الرفع." : isEnglish ? "Upload failed." : "L’upload a échoué."));
        return;
      }

      updatePoint(point.id, { media_url: result.media_url, media_type: result.media_type });
      setStatus(isArabic ? "تمت إضافة الصورة." : isEnglish ? "Photo added." : "Photo ajoutée.");
      window.setTimeout(() => setStatus(null), 1400);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setStatus(
        isArabic
          ? `${message}. جرّب صورة أصغر أو تحقق من إعدادات Cloudinary.`
          : isEnglish
            ? `${message}. Try a smaller photo or check Cloudinary settings.`
            : `${message}. Essayez une photo plus légère ou vérifiez Cloudinary.`,
      );
    } finally {
      setUploadingPointId(null);
    }
  }

  async function submit(identityEmail = creatorEmail, identitySecret = accountSecret) {
    setStatus(null);
    if (!identityEmail || !identitySecret) {
      setIdentityError(null);
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
        finalMessage,
        audioUrl,
        secret_code: secretCode,
        account_secret: identitySecret,
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
      else router.push(`/${lang}/share?mapId=${result.id}`);
    });
  }

  async function continueWithGoogle() {
    setStatus(null);
    setIdentityError(null);
    const auth = getFirebaseClientAuth();
    if (!auth) {
      setIdentityError(isArabic ? "تسجيل الدخول عبر Google غير مفعّل حالياً." : isEnglish ? "Google login is not configured yet." : "La connexion Google n’est pas encore configurée.");
      return;
    }

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const nextEmail = credential.user.email || email;
      if (!nextEmail) {
        setIdentityError(isArabic ? "لم نتمكن من استرجاع بريدك الإلكتروني من Google." : isEnglish ? "We could not retrieve your email from Google." : "Impossible de récupérer votre email depuis Google.");
        return;
      }

      if (accountSecret.trim().length < 4) {
        setIdentityError(isArabic ? "اختر رمز حساب من 4 أحرف على الأقل." : isEnglish ? "Choose an account secret code of at least 4 characters." : "Choisissez un code secret de compte d’au moins 4 caractères.");
        return;
      }

      setCreatorEmail(nextEmail);
      setEmail(nextEmail);
      window.localStorage.setItem("pinstory_creator_email", nextEmail);
      window.localStorage.setItem("pinstory_account_secret", accountSecret.trim());
      setShowIdentityGate(false);
      await submit(nextEmail, accountSecret.trim());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign-in failed";
      setIdentityError(
        isArabic
          ? `تعذر الاتصال عبر Google: ${message}`
          : isEnglish
            ? `Google sign-in failed: ${message}`
            : `La connexion Google a échoué : ${message}`,
      );
    }
  }

  function continueWithEmail() {
    const normalizedEmail = email.trim();
    setIdentityError(null);

    if (!normalizedEmail) {
      setIdentityError(isArabic ? "أدخل بريدك الإلكتروني أولاً." : isEnglish ? "Enter your email first." : "Entrez d’abord votre email.");
      return;
    }

    if (!normalizedEmail.includes("@")) {
      setIdentityError(isArabic ? "أدخل بريداً إلكترونياً صحيحاً." : isEnglish ? "Enter a valid email address." : "Entrez une adresse email valide.");
      return;
    }

    const normalizedSecret = accountSecret.trim();
    if (normalizedSecret.length < 4) {
      setIdentityError(isArabic ? "اختر رمز حساب من 4 أحرف على الأقل." : isEnglish ? "Choose an account secret code of at least 4 characters." : "Choisissez un code secret de compte d’au moins 4 caractères.");
      return;
    }

    setEmail(normalizedEmail);
    setCreatorEmail(normalizedEmail);
    setAccountSecret(normalizedSecret);
    window.localStorage.setItem("pinstory_creator_email", normalizedEmail);
    window.localStorage.setItem("pinstory_account_secret", normalizedSecret);
    setShowIdentityGate(false);
    void submit(normalizedEmail, normalizedSecret);
  }

  return (
    <main className="configurator-layout">
      <section className="configurator-sidebar" aria-label="Map configurator">
        <div className="form-stack">
          <BrandLogo href={`/${lang}`} />
          <h1 className="section-title" style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)" }}>
            {isArabic ? "أنشئ خريطة ذكرياتك" : isEnglish ? "Build your memory map" : "Construisez votre carte souvenir"}
          </h1>

          <div className="selected-plan-card">
            {plan === "mini" ? (
              <div className={`mini-quota-badge ${miniQuota.remaining <= 0 ? "is-paid" : "is-free"}`}>
                <span>{miniQuota.remaining <= 0 ? "$2" : isArabic ? "مجاني" : "GRATUIT"}</span>
                <strong>{getMiniQuotaText()}</strong>
              </div>
            ) : null}
            <span>{isArabic ? "الخطة المختارة" : isEnglish ? "Selected plan" : "Formule choisie"}</span>
            <strong>{dictionary.plans[plan]}</strong>
            <small>
              {isArabic
                ? "لتغيير الخطة، ارجع إلى صفحة الأسعار واختر عرضاً آخر."
                : isEnglish
                  ? "To change it, go back to pricing and choose another plan."
                  : "Pour la changer, revenez aux offres et choisissez une autre formule."}
            </small>
          </div>

          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@example.com" />
            {creatorEmail ? (
              <small className="field-hint">{isArabic ? `متصل كـ ${creatorEmail}` : isEnglish ? `Connected as ${creatorEmail}` : `Connecté avec ${creatorEmail}`}</small>
            ) : null}
          </div>

          <div className="form-field">
            <label htmlFor="title">{isArabic ? "عنوان الخريطة" : isEnglish ? "Map title" : "Titre de la carte"}</label>
            <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="form-field">
            <label htmlFor="message">Message</label>
            <textarea id="message" rows={3} value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>

          <div className="form-field">
            <label htmlFor="final-message">{isArabic ? "رسالة النهاية" : isEnglish ? "Final message" : "Message final"}</label>
            <textarea
              id="final-message"
              rows={4}
              value={finalMessage}
              onChange={(event) => setFinalMessage(event.target.value)}
              placeholder={isArabic ? "اكتب رسالة ختامية تظهر في نهاية الرحلة..." : isEnglish ? "Write the closing message shown at the end..." : "Écrivez le message de conclusion affiché à la fin..."}
            />
          </div>

          <div className="form-field">
            <label htmlFor="secret-code">{isArabic ? "رمز سري (اختياري)" : isEnglish ? "Secret code (optional)" : "Code secret (optionnel)"}</label>
            <input
              id="secret-code"
              value={secretCode}
              onChange={(event) => setSecretCode(event.target.value)}
              placeholder={isArabic ? "مثال: 2405" : isEnglish ? "Example: 2405" : "Exemple : 2405"}
            />
            <small className="field-hint">
              {isArabic
                ? "إذا أضفته، يجب على الزوار كتابته قبل مشاهدة الألبوم من الرابط أو رمز QR."
                : isEnglish
                ? "If you add one, visitors must type it before seeing the album from the link or QR Code."
                : "Si vous en ajoutez un, les visiteurs devront le saisir avant de voir l’album depuis le lien ou le QR Code."}
            </small>
          </div>

          <div className="form-field">
            <label htmlFor="theme">Thème</label>
            <div className="theme-choice-grid" id="theme" role="radiogroup" aria-label="Theme">
              {ALL_THEMES.map((item) => {
                const isAvailable = availableThemes.includes(item);
                const isSelected = theme === item;

                return (
                  <button
                    className={`theme-choice-card ${isSelected ? "active" : ""} ${!isAvailable ? "disabled" : ""}`}
                    key={item}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-disabled={!isAvailable}
                    disabled={!isAvailable}
                    onClick={() => setTheme(item)}
                  >
                    <span className={`theme-swatch ${item}`} aria-hidden="true" />
                    <strong>{getThemeLabel(item)}</strong>
                    {!isAvailable ? (
                      <small>
                        {isArabic
                          ? "متاح في عرض أعلى"
                          : isEnglish
                            ? "Higher plan"
                            : "Offre supérieure"}
                      </small>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <small className="field-hint">
              {plan === "mini"
                ? isArabic
                  ? "خطة Mini تستخدم حالياً الثيم البسيط فقط."
                  : isEnglish
                    ? "Mini currently uses the Minimalist theme only."
                    : "Mini utilise actuellement uniquement le thème minimaliste."
                : isArabic
                  ? "اختر الثيم المتاح في خطتك."
                  : isEnglish
                    ? "Choose any theme included in your plan."
                    : "Choisissez un thème inclus dans votre formule."}
            </small>
          </div>

          <AudioSelector lang={lang} selectedUrl={audioUrl} onSelect={setAudioUrl} />

          <div>
            <h2>{isArabic ? "الذكريات" : isEnglish ? "Memories" : "Souvenirs"}</h2>
            <p className="section-copy" style={{ marginBottom: "1rem" }}>
              {points.length}/{Number.isFinite(limits.maxPoints) ? limits.maxPoints : "∞"} {isArabic ? "ذكريات مستخدمة" : isEnglish ? "memories used" : "souvenirs utilisés"}
            </p>
            {points.map((point) => (
              <article className={`poi-card-item ${activePointId === point.id ? "active" : ""}`} key={point.id} onFocus={() => setActivePointId(point.id)}>
                <div className="form-stack">
                  <button className="segment-button" type="button" onClick={() => setActivePointId(point.id)}>
                    {isArabic ? "تعديل هذه الذكرى" : isEnglish ? "Edit this memory" : "Modifier ce souvenir"} #{point.order}
                  </button>

                  <div className="form-field">
                    <label>{isArabic ? "صورة أو فيديو" : isEnglish ? "Photo or video" : "Photo ou vidéo"}</label>
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
                          ? isArabic
                            ? "جاري الرفع..."
                            : isEnglish
                            ? "Uploading..."
                            : "Upload en cours..."
                          : limits.videos
                            ? isArabic
                              ? "أضف صورة أو فيديو لهذه الذكرى."
                              : isEnglish
                              ? "Upload one image or video for this memory."
                              : "Ajoutez une image ou une vidéo pour ce souvenir."
                            : isArabic
                              ? "أضف صورة واحدة لهذه الذكرى."
                              : isEnglish
                              ? "Upload one photo for this memory."
                              : "Ajoutez une photo pour ce souvenir."
                        : isArabic
                          ? "الوسائط غير مفعلة في المعاينة المجانية."
                          : isEnglish
                          ? "Media is disabled on the Free preview."
                          : "Les médias sont désactivés sur l’aperçu gratuit."}
                    </small>
                  </div>

                  <div className="form-field">
                    <label>{isArabic ? "المكان" : isEnglish ? "Place" : "Lieu"}</label>
                    <div className="place-search-row">
                      <input
                        value={point.location_query || point.place_name}
                        onChange={(event) => updatePoint(point.id, { location_query: event.target.value, place_name: event.target.value })}
                        placeholder={isArabic ? "برج إيفل، باريس، اسم فندق..." : isEnglish ? "Eiffel Tower, Paris, hotel name..." : "Tour Eiffel, Paris, nom d'hôtel..."}
                      />
                      <button className="btn-secondary" type="button" onClick={() => searchPlace(point)}>
                        {isArabic ? "بحث" : isEnglish ? "Find" : "Trouver"}
                      </button>
                    </div>
                    <small className="field-hint">
                      {isArabic
                        ? "لا حاجة لإدخال إحداثيات. ابحث، انقر على المعاينة، أو استخدم موقعك الحالي."
                        : isEnglish
                        ? "No coordinates to type. Search, click the preview map, or use your current position."
                        : "Aucune coordonnée à saisir. Cherchez, cliquez sur l’aperçu ou utilisez votre position."}
                    </small>
                  </div>

                  <div className="poi-actions">
                    <button className="btn-secondary" type="button" onClick={() => selectCurrentPosition(point)}>
                      {isArabic ? "استخدم موقعي" : isEnglish ? "Use my position" : "Utiliser ma position"}
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => removePoint(point.id)} disabled={points.length === 1}>
                      {isArabic ? "حذف" : isEnglish ? "Remove" : "Retirer"}
                    </button>
                  </div>

                  <div className="form-field">
                    <label>{isArabic ? "العنوان" : isEnglish ? "Title" : "Titre"}</label>
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
              {isArabic ? "إضافة ذكرى" : isEnglish ? "Add a memory" : "Ajouter un souvenir"}
            </button>
          </div>

          {status ? (
            <p role="alert" className="section-copy">
              {status}
            </p>
          ) : null}
          <button className="btn-cta" type="button" onClick={() => void submit()} disabled={isPending || !title || points.length === 0}>
            {plan === "mini" ? dictionary.cta.save : dictionary.cta.checkout}
          </button>
        </div>
      </section>

      <aside className="configurator-preview" aria-label={dictionary.navigation.preview}>
        <LiveMapPreview title={title} message={message} points={points} theme={theme} onPickLocation={pickLocationFromPreview} />
      </aside>

      {showIdentityGate ? (
        <div className="identity-modal-backdrop" role="dialog" aria-modal="true" aria-label={isArabic ? "متابعة" : isEnglish ? "Continue" : "Continuer"}>
          <div className="identity-modal">
            <BrandLogo href={`/${lang}`} />
            <h2>{isArabic ? "حفظ ألبومك" : isEnglish ? "Save your album" : "Sauvegarder votre album"}</h2>
            <p>
              {isArabic
                ? "تابع باستخدام Google أو البريد الإلكتروني لحفظ ذكرياتك. لا حاجة إلى كلمة مرور."
                : isEnglish
                ? "Continue with Google or email to save your memories. No password required."
                : "Continuez avec Google ou email pour sauvegarder vos souvenirs. Aucun mot de passe requis."}
            </p>
            <div className="form-field">
              <label htmlFor="identity-email">Email</label>
              <input
                id="identity-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
                autoComplete="email"
              />
            </div>
            <div className="form-field">
              <label htmlFor="account-secret">
                {isArabic ? "رمز حسابك السري" : isEnglish ? "Your account secret code" : "Votre code secret de compte"}
              </label>
              <input
                id="account-secret"
                type="password"
                value={accountSecret}
                onChange={(event) => setAccountSecret(event.target.value)}
                placeholder={isArabic ? "4 أحرف على الأقل" : isEnglish ? "At least 4 characters" : "Au moins 4 caractères"}
                autoComplete="current-password"
              />
              <small className="field-hint">
                {isArabic
                  ? "سيُطلب هذا الرمز لاحقاً لعرض قائمة ذكرياتك بهذا البريد."
                  : isEnglish
                    ? "This code will be required later to view your memories for this email."
                    : "Ce code sera demandé plus tard pour voir vos souvenirs liés à cet email."}
              </small>
            </div>
            {identityError ? (
              <p className="secret-error" role="alert">
                {identityError}
              </p>
            ) : null}
            <button className="btn-cta" type="button" onClick={continueWithGoogle}>
              {isArabic ? "المتابعة باستخدام Google" : isEnglish ? "Continue with Google" : "Continuer avec Google"}
            </button>
            <button className="btn-secondary" type="button" onClick={continueWithEmail}>
              {isArabic ? "المتابعة بالبريد الإلكتروني" : isEnglish ? "Continue with email" : "Continuer avec email"}
            </button>
            <button className="cookie-button cookie-button-muted" type="button" onClick={() => setShowIdentityGate(false)}>
              {isArabic ? "إلغاء" : isEnglish ? "Cancel" : "Annuler"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
