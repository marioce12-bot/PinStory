"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
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
type RecipientType = "self" | "friend" | "partner" | "best_friend" | "acquaintance";
type PlaceParts = { country: string; city: string; district: string };
type MapTilerFeature = { place_name?: string; text?: string; center?: [number, number]; geometry?: { coordinates?: [number, number] } };
type NominatimPlace = { display_name?: string; lon?: string; lat?: string };

const RECIPIENT_TYPES: RecipientType[] = ["self", "friend", "partner", "best_friend", "acquaintance"];
const ALL_THEMES = ["minimalist", "pastel", "dark-luxe", "premium-gold"] as const satisfies readonly ThemeStyle[];
const MAX_UPLOAD_IMAGE_SIZE = 1280;
const IMAGE_COMPRESSION_QUALITY = 0.68;
const UPLOAD_TIMEOUT_MS = 45000;
const VIDEO_CLIP_DURATION = 20;

type PendingVideoClip = {
  pointId: string;
  file: File;
  duration: number;
  start: number;
  previewUrl: string;
};
type CloudinarySignResponse = { cloudName?: string; apiKey?: string; folder?: string; timestamp?: string; signature?: string; error?: string };

function getStoredValue(key: string) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) || "";
}

const defaultPoint = (order: number, lang: Locale): MemoryPoint => ({
  id: crypto.randomUUID(),
  order,
  title: order === 1 ? (lang === "ar" ? "الذكرى الأولى" : lang === "en" ? "The first memory" : "Le premier souvenir") : `${lang === "ar" ? "ذكرى" : lang === "en" ? "Memory" : "Souvenir"} ${order}`,
  date: "2024-05-12",
  description: lang === "ar" ? "جملة قصيرة عن هذه اللحظة." : lang === "en" ? "A short sentence about this moment." : "Une petite phrase sur ce moment.",
  place_name: order === 1 ? "Tour Eiffel, Paris" : "Paris, France",
  location_query: order === 1 ? "Tour Eiffel, Paris" : "Paris, France",
  longitude: 2.2945 + order * 0.01,
  latitude: 48.8584 + order * 0.01,
});

async function compressImageForUpload(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
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
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", IMAGE_COMPRESSION_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

function uploadWithProgress(formData: FormData, onProgress: (percent: number) => void) {
  return new Promise<{ media_url?: string; media_type?: "image" | "video"; error?: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const timeout = window.setTimeout(() => {
      request.abort();
      reject(new Error("Upload timeout"));
    }, UPLOAD_TIMEOUT_MS);

    request.open("POST", "/api/upload");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      window.clearTimeout(timeout);
      try {
        const payload = JSON.parse(request.responseText || "{}") as { media_url?: string; media_type?: "image" | "video"; error?: string };
        if (request.status >= 200 && request.status < 300) resolve(payload);
        else reject(new Error(payload.error || "Upload failed"));
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

function getVideoDuration(file: File) {
  return new Promise<{ duration: number; previewUrl: string }>((resolve, reject) => {
    const previewUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve({ duration: video.duration, previewUrl });
    video.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new Error("Unable to read video duration"));
    };
    video.src = previewUrl;
  });
}

function getCloudinaryClipUrl(url: string, start: number) {
  if (!url.includes("/upload/")) return url;
  const safeStart = Math.max(0, Math.floor(start));
  return url.replace("/upload/", `/upload/so_${safeStart},du_${VIDEO_CLIP_DURATION},q_auto:good/`);
}

function uploadVideoDirectToCloudinary(file: File, onProgress: (percent: number) => void) {
  return new Promise<{ media_url?: string; error?: string }>(async (resolve, reject) => {
    let signPayload: CloudinarySignResponse;

    try {
      const signResponse = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "pinstory-memories" }),
      });
      signPayload = (await signResponse.json()) as CloudinarySignResponse;
      if (!signResponse.ok || !signPayload.cloudName || !signPayload.apiKey || !signPayload.timestamp || !signPayload.signature) {
        reject(new Error(signPayload.error || "Unable to sign Cloudinary upload"));
        return;
      }
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Unable to prepare Cloudinary upload"));
      return;
    }

    const request = new XMLHttpRequest();
    request.open("POST", `https://api.cloudinary.com/v1_1/${signPayload.cloudName}/video/upload`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      try {
        const payload = JSON.parse(request.responseText || "{}") as { secure_url?: string; error?: { message?: string } };
        if (request.status >= 200 && request.status < 300) {
          resolve({ media_url: payload.secure_url });
          return;
        }
        reject(new Error(payload.error?.message || "Video upload failed"));
      } catch {
        reject(new Error(`Invalid upload response (${request.status})`));
      }
    };
    request.onerror = () => reject(new Error("Network upload error"));
    request.onabort = () => reject(new Error("Upload cancelled"));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signPayload.apiKey);
    formData.append("timestamp", signPayload.timestamp);
    formData.append("signature", signPayload.signature);
    formData.append("folder", signPayload.folder || "pinstory-memories");
    request.send(formData);
  });
}

export function Configurator({ lang, dictionary, initialPlan }: { lang: Locale; dictionary: Dictionary; initialPlan: Plan }) {
  const router = useRouter();
  const isArabic = lang === "ar";
  const isEnglish = lang === "en";
  const [isPending, startTransition] = useTransition();
  const plan = initialPlan;
  const memoryLang: Locale = lang;
  const limits = PLAN_LIMITS[plan];
  const availableThemes = limits.themes as readonly ThemeStyle[];

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(() => getStoredValue("pinstory_creator_email"));
  const [creatorEmail, setCreatorEmail] = useState(() => getStoredValue("pinstory_creator_email"));
  const [accountSecret, setAccountSecret] = useState(() => getStoredValue("pinstory_account_secret"));
  const [showIdentityGate, setShowIdentityGate] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [recipientType, setRecipientType] = useState<RecipientType>("partner");
  const [recipientName, setRecipientName] = useState("");
  const [title, setTitle] = useState(lang === "ar" ? "قصتنا" : lang === "en" ? "Our story" : "Notre histoire");
  const [message, setMessage] = useState(lang === "ar" ? "خريطة حيّة لنا." : lang === "en" ? "A living map of us." : "Une carte vivante de nous.");
  const [finalMessage, setFinalMessage] = useState(lang === "ar" ? "شكراً لأنك عشت هذه الرحلة معنا." : lang === "en" ? "Thank you for reliving this journey with us." : "Merci d’avoir revécu ce voyage avec nous.");
  const [secretCode, setSecretCode] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [theme, setTheme] = useState<ThemeStyle>(PLAN_LIMITS[initialPlan].themes[0] as ThemeStyle);
  const [points, setPoints] = useState<MemoryPoint[]>([defaultPoint(1, lang)]);
  const [activePointId, setActivePointId] = useState(points[0].id);
  const [placeParts, setPlaceParts] = useState<Record<string, PlaceParts>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [pendingVideoClip, setPendingVideoClip] = useState<PendingVideoClip | null>(null);
  const activePoint = points.find((point) => point.id === activePointId) || points[0];

  const copy = {
    steps: isArabic ? ["الوجهة", "الصور", "النهاية", "الإنشاء"] : isEnglish ? ["Recipient", "Photos", "Final", "Create"] : ["Destinataire", "Photos", "Final", "Création"],
    back: isArabic ? "رجوع" : isEnglish ? "Back" : "Retour",
    next: isArabic ? "متابعة" : isEnglish ? "Continue" : "Continuer",
    create: plan === "mini" ? dictionary.cta.save : dictionary.cta.checkout,
  };

  function getStepTitle(currentStep: number) {
    if (currentStep === 1) return isArabic ? "لمن هذا souvenir؟" : isEnglish ? "Who is this memory for?" : "Pour qui est ce souvenir ?";
    if (currentStep === 2) return isArabic ? "اختر الصور واكتب الذكريات" : isEnglish ? "Choose photos and write memories" : "Choisissez les photos et écrivez les souvenirs";
    if (currentStep === 3) return isArabic ? "رسالة النهاية والموسيقى" : isEnglish ? "Final message and music" : "Message de fin et musique";
    return isArabic ? "تأكيد وإنشاء" : isEnglish ? "Review and create" : "Récapitulatif et création";
  }

  function getRecipientLabel(item: RecipientType) {
    const labels = {
      self: isArabic ? "لي" : isEnglish ? "For me" : "Pour moi",
      friend: isArabic ? "لصديق" : isEnglish ? "A friend" : "Un ami",
      partner: isArabic ? "لشريكي" : isEnglish ? "My partner" : "Mon/ma partenaire",
      best_friend: isArabic ? "لأفضل صديق" : isEnglish ? "My best friend" : "Mon/ma meilleur(e) ami(e)",
      acquaintance: isArabic ? "لمعرفة" : isEnglish ? "An acquaintance" : "Une connaissance",
    } satisfies Record<RecipientType, string>;
    return labels[item];
  }

  function getThemeLabel(item: ThemeStyle) {
    if (item === "minimalist") return isArabic ? "بسيط" : isEnglish ? "Minimalist" : "Minimaliste";
    if (item === "pastel") return isArabic ? "باستيل" : "Pastel";
    if (item === "dark-luxe") return isArabic ? "فاخر داكن" : isEnglish ? "Dark luxe" : "Sombre luxe";
    return isArabic ? "ذهبي فاخر" : isEnglish ? "Premium gold" : "Premium doré";
  }

  function updatePoint(id: string, patch: Partial<MemoryPoint>) {
    setPoints((current) => current.map((point) => (point.id === id ? { ...point, ...patch } : point)));
  }

  function updatePlacePart(point: MemoryPoint, field: keyof PlaceParts, value: string) {
    const current = placeParts[point.id] || { country: "", city: "", district: "" };
    const next = { ...current, [field]: value };
    const query = [next.district, next.city, next.country].filter(Boolean).join(", ");
    setPlaceParts((state) => ({ ...state, [point.id]: next }));
    updatePoint(point.id, { location_query: query, place_name: query || point.place_name });
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
        const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${mapTilerKey}&language=${memoryLang}&limit=1`);
        const result = (await response.json()) as { features?: MapTilerFeature[] };
        const feature = result.features?.[0];
        const coordinates = feature?.center || feature?.geometry?.coordinates;
        if (coordinates) {
          updatePoint(point.id, { place_name: feature?.place_name || feature?.text || query, location_query: query, longitude: coordinates[0], latitude: coordinates[1] });
          return;
        }
      }
      const nominatimResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, { headers: { "Accept-Language": memoryLang } });
      const places = (await nominatimResponse.json()) as NominatimPlace[];
      const place = places[0];
      if (!place?.lat || !place.lon) {
        setStatus(isArabic ? "لم يتم العثور على مكان." : isEnglish ? "No place found." : "Aucun lieu trouvé.");
        return;
      }
      updatePoint(point.id, { place_name: place.display_name || query, location_query: query, longitude: Number(place.lon), latitude: Number(place.lat) });
    } catch {
      updatePoint(point.id, { place_name: query, location_query: query });
      setStatus(isArabic ? "تم حفظ المكان." : isEnglish ? "Place saved." : "Lieu enregistré.");
    }
  }

  function selectCurrentPosition(point: MemoryPoint) {
    if (!navigator.geolocation) {
      setStatus(isArabic ? "تحديد الموقع غير متاح." : isEnglish ? "Geolocation unavailable." : "Géolocalisation indisponible.");
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      updatePoint(point.id, { place_name: isArabic ? "الموقع الحالي" : isEnglish ? "Current position" : "Position actuelle", location_query: isArabic ? "الموقع الحالي" : isEnglish ? "Current position" : "Position actuelle", longitude: Number(position.coords.longitude.toFixed(5)), latitude: Number(position.coords.latitude.toFixed(5)) });
    });
  }

  function pickLocationFromPreview(longitude: number, latitude: number, label: string) {
    if (!activePoint) return;
    updatePoint(activePoint.id, { place_name: isArabic ? "تم التحديد على الخريطة" : isEnglish ? "Selected on the map" : label, location_query: isArabic ? "تم التحديد على الخريطة" : isEnglish ? "Selected on the map" : label, longitude, latitude });
  }

  async function uploadMedia(point: MemoryPoint, file: File | undefined) {
    if (!file) return;

    try {
      if (file.type.startsWith("video/")) {
        const { duration, previewUrl } = await getVideoDuration(file);

        if (duration > VIDEO_CLIP_DURATION) {
          setPendingVideoClip({ pointId: point.id, file, duration, start: 0, previewUrl });
          setActivePointId(point.id);
          setStatus(isArabic ? "اختر مقطعاً مدته 20 ثانية من الفيديو." : isEnglish ? "Choose a 20-second section from this video." : "Choisissez une section de 20 secondes dans cette vidéo.");
          return;
        }

        setStatus(isArabic ? "رفع الفيديو..." : isEnglish ? "Uploading video..." : "Upload de la vidéo...");
        const result = await uploadVideoDirectToCloudinary(file, (percent) => setStatus(isArabic ? `رفع الفيديو... ${percent}%` : isEnglish ? `Uploading video... ${percent}%` : `Upload vidéo... ${percent}%`));
        if (!result.media_url) {
          setStatus(result.error || (isArabic ? "فشل رفع الفيديو." : isEnglish ? "Video upload failed." : "L’upload de la vidéo a échoué."));
          return;
        }
        updatePoint(point.id, { media_url: getCloudinaryClipUrl(result.media_url, 0), media_type: "video" });
        setStatus(isArabic ? "تمت إضافة الفيديو." : isEnglish ? "Video added." : "Vidéo ajoutée.");
        window.setTimeout(() => setStatus(null), 1400);
        return;
      }

      const fileToUpload = file.type.startsWith("image/") ? await compressImageForUpload(file) : file;
      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("plan", plan);
      const result = await uploadWithProgress(formData, (percent) => setStatus(isArabic ? `جاري الرفع... ${percent}%` : isEnglish ? `Uploading... ${percent}%` : `Upload en cours... ${percent}%`));
      if (!result.media_url) {
        setStatus(result.error || (isArabic ? "فشل الرفع." : isEnglish ? "Upload failed." : "L’upload a échoué."));
        return;
      }
      updatePoint(point.id, { media_url: result.media_url, media_type: result.media_type });
      setStatus(isArabic ? "تمت إضافة الصورة." : isEnglish ? "Photo added." : "Photo ajoutée.");
      window.setTimeout(() => setStatus(null), 1400);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setStatus(message);
    }
  }

  async function confirmVideoClip() {
    if (!pendingVideoClip) return;

    try {
      setStatus(isArabic ? "رفع مقطع الفيديو..." : isEnglish ? "Uploading selected clip..." : "Upload de l’extrait vidéo...");
      const result = await uploadVideoDirectToCloudinary(pendingVideoClip.file, (percent) => {
        setStatus(isArabic ? `رفع مقطع الفيديو... ${percent}%` : isEnglish ? `Uploading selected clip... ${percent}%` : `Upload de l’extrait vidéo... ${percent}%`);
      });

      if (!result.media_url) {
        setStatus(result.error || (isArabic ? "فشل رفع الفيديو." : isEnglish ? "Video upload failed." : "L’upload de la vidéo a échoué."));
        return;
      }

      updatePoint(pendingVideoClip.pointId, {
        media_url: getCloudinaryClipUrl(result.media_url, pendingVideoClip.start),
        media_type: "video",
      });
      URL.revokeObjectURL(pendingVideoClip.previewUrl);
      setPendingVideoClip(null);
      setStatus(isArabic ? "تمت إضافة مقطع 20 ثانية." : isEnglish ? "20-second video clip added." : "Extrait vidéo de 20 secondes ajouté.");
      window.setTimeout(() => setStatus(null), 1600);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : isArabic ? "فشل رفع الفيديو." : isEnglish ? "Video upload failed." : "L’upload de la vidéo a échoué.");
    }
  }

  function cancelVideoClip() {
    if (pendingVideoClip) URL.revokeObjectURL(pendingVideoClip.previewUrl);
    setPendingVideoClip(null);
  }

  function canGoNext() {
    if (step === 1) return title.trim().length > 0 && (recipientType === "self" || recipientName.trim().length > 0);
    if (step === 2) return points.every((point) => point.media_url && point.title.trim() && point.description.trim() && point.place_name.trim());
    if (step === 3) return finalMessage.trim().length > 0;
    return true;
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
      body: JSON.stringify({ client_email: identityEmail || email, lang: memoryLang, plan, theme_style: theme, title, message, recipient_type: recipientType, recipient_name: recipientName, finalMessage, audioUrl, secret_code: secretCode, account_secret: identitySecret, points }),
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
    setIdentityError(null);
    const auth = getFirebaseClientAuth();
    if (!auth) {
      setIdentityError(isArabic ? "Google غير مفعّل." : isEnglish ? "Google login is not configured." : "Google n’est pas configuré.");
      return;
    }
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const nextEmail = credential.user.email || email;
      if (!nextEmail || accountSecret.trim().length < 4) {
        setIdentityError(isArabic ? "أدخل البريد والرمز السري." : isEnglish ? "Enter email and secret code." : "Entrez l’email et le code secret.");
        return;
      }
      setCreatorEmail(nextEmail);
      setEmail(nextEmail);
      window.localStorage.setItem("pinstory_creator_email", nextEmail);
      window.localStorage.setItem("pinstory_account_secret", accountSecret.trim());
      setShowIdentityGate(false);
      await submit(nextEmail, accountSecret.trim());
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : "Google sign-in failed");
    }
  }

  function continueWithEmail() {
    const normalizedEmail = email.trim();
    const normalizedSecret = accountSecret.trim();
    setIdentityError(null);
    if (!normalizedEmail.includes("@") || normalizedSecret.length < 4) {
      setIdentityError(isArabic ? "أدخل بريداً ورمزاً صحيحين." : isEnglish ? "Enter a valid email and secret code." : "Entrez un email valide et un code secret.");
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
        <div className="form-stack wizard-shell">
          <BrandLogo href={`/${lang}`} />
          <h1 className="section-title" style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)" }}>{isArabic ? "أنشئ خريطة ذكرياتك" : isEnglish ? "Build your memory map" : "Construisez votre carte souvenir"}</h1>

          <div className="wizard-progress" aria-label="Creation steps">
            {[1, 2, 3, 4].map((item) => (
              <button className={`wizard-step-dot ${step === item ? "active" : ""} ${step > item ? "done" : ""}`} key={item} type="button" onClick={() => setStep(item)}>
                <span>{item}</span>
                <small>{copy.steps[item - 1]}</small>
              </button>
            ))}
          </div>

          <div className="selected-plan-card">
            <span>{isArabic ? "الخطة المختارة" : isEnglish ? "Selected plan" : "Formule choisie"}</span>
            <strong>{dictionary.plans[plan]}</strong>
          </div>

          <section className="wizard-card">
            <p className="popup-date">{isArabic ? `الخطوة ${step} من 4` : isEnglish ? `Step ${step} of 4` : `Étape ${step} sur 4`}</p>
            <h2>{getStepTitle(step)}</h2>

            {step === 1 ? (
              <div className="form-stack">
                <div className="form-field">
                  <label>{isArabic ? "لمن تريد تقديم هذا الألبوم؟" : isEnglish ? "Who do you want to offer this memory to?" : "Pour qui voulez-vous offrir ce souvenir ?"}</label>
                  <div className="recipient-grid">
                    {RECIPIENT_TYPES.map((item) => <button className={`segment-button ${recipientType === item ? "active" : ""}`} key={item} type="button" onClick={() => setRecipientType(item)}>{getRecipientLabel(item)}</button>)}
                  </div>
                </div>
                {recipientType !== "self" ? <div className="form-field"><label htmlFor="recipient-name">{isArabic ? "اسم الشخص" : isEnglish ? "Recipient name" : "Nom de la personne"}</label><input id="recipient-name" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} /></div> : null}
                <div className="form-field"><label htmlFor="title">{isArabic ? "عنوان الألبوم" : isEnglish ? "Album title" : "Titre général de l’album"}</label><input id="title" value={title} onChange={(event) => setTitle(event.target.value)} /></div>
                <div className="form-field"><label htmlFor="message">{isArabic ? "رسالة قصيرة" : isEnglish ? "Short introduction" : "Petit texte d’introduction"}</label><textarea id="message" rows={3} value={message} onChange={(event) => setMessage(event.target.value)} /></div>
              </div>
            ) : null}

            {step === 2 ? (
              <div>
                <p className="section-copy" style={{ marginBottom: "1rem" }}>{points.length}/{Number.isFinite(limits.maxPoints) ? limits.maxPoints : "∞"} {isArabic ? "ذكريات" : isEnglish ? "memories" : "souvenirs"}</p>
                {points.map((point) => {
                  const parts = placeParts[point.id] || { country: "", city: "", district: "" };
                  return (
                    <article className={`poi-card-item ${activePointId === point.id ? "active" : ""}`} key={point.id}>
                      <div className="form-stack">
                        <button className="segment-button" type="button" onClick={() => setActivePointId(point.id)}>{isArabic ? "تعديل الذكرى" : isEnglish ? "Edit memory" : "Modifier le souvenir"} #{point.order}</button>
                        <div className="form-field">
                          <label>{isArabic ? "اختر صورة أو فيديو" : isEnglish ? "Choose a photo or video" : "Choisir une photo ou une vidéo"}</label>
                          {point.media_url ? (
                            <div className="media-preview-card">
                              {point.media_type === "video" ? <video src={point.media_url} controls /> : <Image src={point.media_url} alt={point.title || point.place_name} width={420} height={260} />}
                            </div>
                          ) : null}
                          <input type="file" accept="image/*,video/*" onChange={(event) => uploadMedia(point, event.target.files?.[0])} />
                          <small className="field-hint">
                            {isArabic
                              ? "الفيديوهات محددة بـ 20 ثانية. إذا كانت أطول، اختر المقطع المطلوب."
                              : isEnglish
                                ? "Videos are limited to 20 seconds. If longer, choose the section to keep."
                                : "Les vidéos sont limitées à 20 secondes. Si elles sont plus longues, choisissez la section à garder."}
                          </small>
                          {pendingVideoClip?.pointId === point.id ? (
                            <div className="video-clip-selector">
                              <video src={pendingVideoClip.previewUrl} controls />
                              <label>
                                <span>
                                  {isArabic
                                    ? `بداية المقطع: ${Math.round(pendingVideoClip.start)} ث`
                                    : isEnglish
                                      ? `Clip start: ${Math.round(pendingVideoClip.start)}s`
                                      : `Début de l’extrait : ${Math.round(pendingVideoClip.start)}s`}
                                </span>
                                <input
                                  type="range"
                                  min="0"
                                  max={Math.max(0, Math.floor(pendingVideoClip.duration - VIDEO_CLIP_DURATION))}
                                  value={pendingVideoClip.start}
                                  onChange={(event) => setPendingVideoClip((clip) => clip ? { ...clip, start: Number(event.target.value) } : clip)}
                                />
                              </label>
                              <p className="field-hint">
                                {isArabic
                                  ? "سيتم الاحتفاظ بـ 20 ثانية ابتداءً من هذا الموضع."
                                  : isEnglish
                                    ? "PinStory will keep 20 seconds from this position."
                                    : "PinStory gardera 20 secondes à partir de cette position."}
                              </p>
                              <div className="poi-actions">
                                <button className="btn-cta" type="button" onClick={() => void confirmVideoClip()}>
                                  {isArabic ? "استخدام هذا المقطع" : isEnglish ? "Use this clip" : "Utiliser cet extrait"}
                                </button>
                                <button className="btn-secondary" type="button" onClick={cancelVideoClip}>
                                  {isArabic ? "إلغاء" : isEnglish ? "Cancel" : "Annuler"}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="form-field"><label>{isArabic ? "عنوان الصورة" : isEnglish ? "Photo title" : "Titre de la photo"}</label><input value={point.title} onChange={(event) => updatePoint(point.id, { title: event.target.value })} /></div>
                        <div className="form-field"><label>{isArabic ? "النص" : isEnglish ? "Text" : "Texte"}</label><textarea rows={2} value={point.description} onChange={(event) => updatePoint(point.id, { description: event.target.value })} /></div>
                        <div className="structured-place-grid">
                          <div className="form-field"><label>{isArabic ? "البلد" : isEnglish ? "Country" : "Pays"}</label><input value={parts.country} onChange={(event) => updatePlacePart(point, "country", event.target.value)} /></div>
                          <div className="form-field"><label>{isArabic ? "المدينة" : isEnglish ? "City" : "Ville"}</label><input value={parts.city} onChange={(event) => updatePlacePart(point, "city", event.target.value)} /></div>
                          <div className="form-field"><label>{isArabic ? "الحي أو المكان" : isEnglish ? "District or place" : "Quartier ou lieu"}</label><input value={parts.district} onChange={(event) => updatePlacePart(point, "district", event.target.value)} /></div>
                        </div>
                        <div className="place-search-row"><input value={point.location_query || point.place_name} onChange={(event) => updatePoint(point.id, { location_query: event.target.value, place_name: event.target.value })} placeholder={isArabic ? "ابحث عن مكان معروف..." : isEnglish ? "Search a known place..." : "Rechercher un lieu connu..."} /><button className="btn-secondary" type="button" onClick={() => searchPlace(point)}>{isArabic ? "بحث" : isEnglish ? "Find" : "Trouver"}</button></div>
                        <div className="form-field"><label>Date</label><input type="date" value={point.date || ""} onChange={(event) => updatePoint(point.id, { date: event.target.value })} /></div>
                        <div className="poi-actions"><button className="btn-secondary" type="button" onClick={() => selectCurrentPosition(point)}>{isArabic ? "استخدم موقعي" : isEnglish ? "Use my position" : "Utiliser ma position"}</button><button className="btn-secondary" type="button" onClick={() => removePoint(point.id)} disabled={points.length === 1}>{isArabic ? "حذف" : isEnglish ? "Remove" : "Retirer"}</button></div>
                      </div>
                    </article>
                  );
                })}
                <button className="btn-secondary" type="button" onClick={addPoint} disabled={points.length >= limits.maxPoints}>{isArabic ? "إضافة ذكرى" : isEnglish ? "Add a memory" : "Ajouter un souvenir"}</button>
              </div>
            ) : null}

            {step === 3 ? <div className="form-stack"><div className="form-field"><label htmlFor="final-message">{isArabic ? "رسالة النهاية" : isEnglish ? "Final message" : "Message de fin"}</label><textarea id="final-message" rows={5} value={finalMessage} onChange={(event) => setFinalMessage(event.target.value)} /></div><AudioSelector lang={lang} selectedUrl={audioUrl} onSelect={setAudioUrl} /><div className="form-field"><label htmlFor="secret-code">{isArabic ? "رمز سري (اختياري)" : isEnglish ? "Secret code (optional)" : "Code secret (optionnel)"}</label><input id="secret-code" value={secretCode} onChange={(event) => setSecretCode(event.target.value)} /></div><div className="form-field"><label>Thème</label><div className="theme-choice-grid">{ALL_THEMES.map((item) => { const isAvailable = availableThemes.includes(item); return <button className={`theme-choice-card ${theme === item ? "active" : ""} ${!isAvailable ? "disabled" : ""}`} key={item} type="button" disabled={!isAvailable} onClick={() => setTheme(item)}><span className={`theme-swatch ${item}`} /><strong>{getThemeLabel(item)}</strong>{!isAvailable ? <small>{isArabic ? "متاح في عرض أعلى" : isEnglish ? "Higher plan" : "Offre supérieure"}</small> : null}</button>; })}</div></div></div> : null}

            {step === 4 ? <div className="wizard-summary"><p><strong>{isArabic ? "الوجهة" : isEnglish ? "Recipient" : "Destinataire"}:</strong> {recipientType === "self" ? getRecipientLabel(recipientType) : `${getRecipientLabel(recipientType)} — ${recipientName}`}</p><p><strong>{isArabic ? "الألبوم" : isEnglish ? "Album" : "Album"}:</strong> {title}</p><p><strong>{isArabic ? "الذكريات" : isEnglish ? "Memories" : "Souvenirs"}:</strong> {points.length}</p><p><strong>{isArabic ? "الموسيقى" : isEnglish ? "Music" : "Musique"}:</strong> {audioUrl ? (isArabic ? "مضافة" : isEnglish ? "Added" : "Ajoutée") : (isArabic ? "بدون موسيقى" : isEnglish ? "No music" : "Sans musique")}</p></div> : null}
          </section>

          {status ? <p role="alert" className="section-copy">{status}</p> : null}
          <div className="wizard-actions"><button className="btn-secondary" type="button" onClick={() => setStep((value) => Math.max(value - 1, 1))} disabled={step === 1}>{copy.back}</button>{step < 4 ? <button className="btn-cta" type="button" onClick={() => setStep((value) => Math.min(value + 1, 4))} disabled={!canGoNext()}>{copy.next}</button> : <button className="btn-cta" type="button" onClick={() => void submit()} disabled={isPending || !canGoNext()}>{copy.create}</button>}</div>
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
            <p>{isArabic ? "تابع باستخدام Google أو البريد الإلكتروني لحفظ ذكرياتك." : isEnglish ? "Continue with Google or email to save your memories." : "Continuez avec Google ou email pour sauvegarder vos souvenirs."}</p>
            <div className="form-field"><label htmlFor="identity-email">Email</label><input id="identity-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@example.com" autoComplete="email" /></div>
            <div className="form-field"><label htmlFor="account-secret">{isArabic ? "رمز حسابك السري" : isEnglish ? "Your account secret code" : "Votre code secret de compte"}</label><input id="account-secret" type="password" value={accountSecret} onChange={(event) => setAccountSecret(event.target.value)} placeholder={isArabic ? "4 أحرف على الأقل" : isEnglish ? "At least 4 characters" : "Au moins 4 caractères"} autoComplete="current-password" /></div>
            {identityError ? <p className="secret-error" role="alert">{identityError}</p> : null}
            <button className="btn-cta" type="button" onClick={continueWithGoogle}>{isArabic ? "المتابعة باستخدام Google" : isEnglish ? "Continue with Google" : "Continuer avec Google"}</button>
            <button className="btn-secondary" type="button" onClick={continueWithEmail}>{isArabic ? "المتابعة بالبريد الإلكتروني" : isEnglish ? "Continue with email" : "Continuer avec email"}</button>
            <button className="cookie-button cookie-button-muted" type="button" onClick={() => setShowIdentityGate(false)}>{isArabic ? "إلغاء" : isEnglish ? "Cancel" : "Annuler"}</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
