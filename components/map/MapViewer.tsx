"use client";

/* eslint-disable @next/next/no-img-element */

import "mapbox-gl/dist/mapbox-gl.css";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { QRCodeCanvas } from "qrcode.react";
import { BackgroundMusic } from "@/components/map/BackgroundMusic";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { getMapboxStyle, PLAN_LIMITS } from "@/lib/plans";
import type { MemoryMap } from "@/lib/types";

type Dictionary = typeof import("@/dictionaries/fr.json");
type StoryPhase = "locked" | "intro" | "flying" | "modal" | "final";

function getDirectionsUrl(point: MemoryMap["points"][number]) {
  const destination = point.place_name || `${point.latitude},${point.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function getCopy(lang: MemoryMap["lang"]) {
  if (lang === "ar") {
    return {
      intro1: "استعد لرحلة صغيرة بين الذكريات...",
      intro2: "اضغط لتكتشف القصة على الخريطة.",
      start: "اكتشف الخريطة",
      continue: "متابعة الرحلة",
      finish: "إنهاء الرحلة",
      copy: "نسخ الرابط",
      copied: "تم نسخ الرابط",
      directions: "اذهب إلى الذكرى",
      downloadQr: "تحميل رمز QR",
      privateAlbum: "ألبوم خاص",
      enterCode: "أدخل الرمز السري لفتح هذا PinStory.",
      codePlaceholder: "الرمز السري",
      wrongCode: "الرمز السري غير صحيح.",
      openAlbum: "فتح الألبوم",
      memories: "الذكريات",
      finalFallback: "شكراً لأنك عشت هذه الرحلة معنا. هذه الذكريات ستبقى دائماً قريبة من القلب.",
    };
  }

  if (lang === "en") {
    return {
      intro1: "Get ready to relive this journey...",
      intro2: "Tap to discover the story on the map.",
      start: "Discover my map",
      continue: "Continue the journey",
      finish: "End the journey",
      copy: "Copy link",
      copied: "Link copied",
      directions: "Get Directions",
      downloadQr: "Download QR",
      privateAlbum: "Private album",
      enterCode: "Enter the secret code to open this PinStory.",
      codePlaceholder: "Secret code",
      wrongCode: "Incorrect secret code.",
      openAlbum: "Open album",
      memories: "Memories",
      finalFallback: "Thank you for reliving this journey with us. These memories will always stay close to our hearts.",
    };
  }

  return {
    intro1: "Préparez-vous à revivre ce voyage...",
    intro2: "Touchez l’écran pour découvrir l’histoire sur la carte.",
    start: "Découvrir ma carte",
    continue: "Continuer le voyage",
    finish: "Terminer le voyage",
    copy: "Copier le lien",
    copied: "Lien copié",
    directions: "S’y rendre",
    downloadQr: "Télécharger le QR",
    privateAlbum: "Album privé",
    enterCode: "Entrez le code secret pour ouvrir ce PinStory.",
    codePlaceholder: "Code secret",
    wrongCode: "Code secret incorrect.",
    openAlbum: "Ouvrir l’album",
    memories: "Souvenirs",
    finalFallback: "Merci d’avoir revécu ce voyage avec nous. Ces souvenirs resteront toujours près du cœur.",
  };
}

export function MapViewer({ map, dictionary }: { map: MemoryMap; dictionary: Dictionary }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const qrRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<HTMLElement[]>([]);
  const flyTimeoutRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<StoryPhase>(map.secret_code ? "locked" : "intro");
  const [showQr, setShowQr] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [secretInput, setSecretInput] = useState("");
  const [secretError, setSecretError] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState(`/map/${map.id}`);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const currentPoint = map.points[activeIndex] || map.points[0];
  const canShowQr = PLAN_LIMITS[map.plan].qrCode;
  const copy = useMemo(() => getCopy(map.lang), [map.lang]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPublicUrl(`${window.location.origin}/map/${map.id}`);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [map.id]);

  useEffect(() => {
    if (!containerRef.current || !mapboxToken || mapRef.current || map.points.length === 0) return;

    mapboxgl.accessToken = mapboxToken;
    const firstPoint = map.points[0];
    const instance = new mapboxgl.Map({
      container: containerRef.current,
      style: getMapboxStyle(map.theme_style),
      center: [firstPoint.longitude, firstPoint.latitude],
      zoom: 3,
      pitch: 0,
    });

    markersRef.current = map.points.map((point, index) => {
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className = "custom-marker cinematic-marker";
      markerElement.setAttribute("aria-label", point.title || point.place_name);
      markerElement.addEventListener("click", () => {
        setActiveIndex(index);
        setPhase("modal");
      });

      new mapboxgl.Marker(markerElement).setLngLat([point.longitude, point.latitude]).addTo(instance);
      return markerElement;
    });

    instance.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    mapRef.current = instance;

    return () => {
      if (flyTimeoutRef.current) window.clearTimeout(flyTimeoutRef.current);
      instance.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [map.points, map.theme_style, mapboxToken]);

  useEffect(() => {
    markersRef.current.forEach((marker, index) => {
      marker.classList.toggle("marker-active", index === activeIndex && phase === "modal");
    });
  }, [activeIndex, phase]);

  function flyToMemory(index: number) {
    const point = map.points[index];
    if (!point) return;

    setActiveIndex(index);
    setPhase("flying");

    if (flyTimeoutRef.current) window.clearTimeout(flyTimeoutRef.current);

    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [point.longitude, point.latitude],
        zoom: 16,
        duration: 4000,
        pitch: 45,
        bearing: index % 2 === 0 ? 18 : -18,
        essential: true,
      });
      flyTimeoutRef.current = window.setTimeout(() => setPhase("modal"), 4200);
    } else {
      flyTimeoutRef.current = window.setTimeout(() => setPhase("modal"), 700);
    }
  }

  function startStory() {
    flyToMemory(0);
  }

  function continueJourney() {
    const nextIndex = activeIndex + 1;
    if (nextIndex < map.points.length) {
      setPhase("flying");
      if (mapRef.current && currentPoint) {
        mapRef.current.flyTo({
          center: [currentPoint.longitude, currentPoint.latitude],
          zoom: 7,
          duration: 1200,
          pitch: 15,
          essential: true,
        });
        window.setTimeout(() => flyToMemory(nextIndex), 1100);
      } else {
        flyToMemory(nextIndex);
      }
      return;
    }

    setPhase("final");
    if (mapRef.current && map.points.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      map.points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
      mapRef.current.fitBounds(bounds, { padding: 90, duration: 3500, pitch: 0, bearing: 0 });
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopyStatus(copy.copied);
    window.setTimeout(() => setCopyStatus(null), 1800);
  }

  function downloadQrCode() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `pinstory-${map.id}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function unlockAlbum() {
    if (!map.secret_code || secretInput.trim() === map.secret_code) {
      setPhase("intro");
      setSecretError(null);
      return;
    }

    setSecretError(copy.wrongCode);
  }

  if (phase === "locked") {
    return (
      <main className="secret-gate-page">
        <div className="secret-gate-card">
          <BrandLogo href={`/${map.lang}`} />
          <p className="popup-date">{copy.privateAlbum}</p>
          <h1>{map.title}</h1>
          <p>{copy.enterCode}</p>
          <input
            value={secretInput}
            onChange={(event) => setSecretInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") unlockAlbum();
            }}
            placeholder={copy.codePlaceholder}
          />
          {secretError ? <p className="secret-error">{secretError}</p> : null}
          <button className="btn-cta" type="button" onClick={unlockAlbum}>
            {copy.openAlbum}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="cinematic-map-shell">
      <BackgroundMusic audioUrl={map.audioUrl} lang={map.lang} />
      {mapboxToken ? <div ref={containerRef} className="map-container-fullscreen" /> : <div className="map-fallback" />}

      {!mapboxToken ? (
        <div className="map-fallback-markers" aria-hidden="true">
          {map.points.slice(0, 8).map((point, index) => (
            <button
              className={`fallback-marker ${index === activeIndex && phase === "modal" ? "marker-active" : ""}`}
              key={point.id}
              style={{ left: `${18 + ((index * 19) % 62)}%`, top: `${22 + ((index * 17) % 56)}%` }}
              type="button"
              onClick={() => {
                setActiveIndex(index);
                setPhase("modal");
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="cinematic-topbar">
        <BrandLogo href={`/${map.lang}`} />
        <div className="map-link-actions">
          <button className="btn-secondary" type="button" onClick={copyLink}>{copy.copy}</button>
          {canShowQr ? <button className="btn-secondary" type="button" onClick={() => setShowQr((value) => !value)}>{dictionary.map.open_qr}</button> : null}
          {copyStatus ? <span className="copy-status">{copyStatus}</span> : null}
        </div>
      </div>

      <AnimatePresence>
        {phase === "intro" ? (
          <motion.section className="cinematic-intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>{copy.intro1}</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>{map.title}</motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.25 }}>{copy.intro2}</motion.p>
            <motion.button className="btn-cta" type="button" onClick={startStory} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.7 }}>
              {copy.start}
            </motion.button>
          </motion.section>
        ) : null}

        {phase === "flying" ? (
          <motion.div className="cinematic-caption" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>
            {currentPoint?.place_name}
          </motion.div>
        ) : null}

        {phase === "modal" && currentPoint ? (
          <motion.section className="cinematic-memory-modal" initial={{ opacity: 0, y: 36, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}>
            {currentPoint.media_url ? (
              <div className="cinematic-memory-media">
                {currentPoint.media_type === "video" ? <video src={currentPoint.media_url} controls /> : <img src={currentPoint.media_url} alt={currentPoint.title || currentPoint.place_name} />}
              </div>
            ) : null}
            <p className="popup-date">{currentPoint.date}</p>
            <h2>{currentPoint.title || currentPoint.place_name}</h2>
            <p className="popup-place">{currentPoint.place_name}</p>
            <p>{currentPoint.description}</p>
            <div className="cinematic-modal-actions">
              <a className="btn-secondary" href={getDirectionsUrl(currentPoint)} target="_blank" rel="noopener noreferrer">{copy.directions}</a>
              <button className="btn-cta" type="button" onClick={continueJourney}>{activeIndex + 1 >= map.points.length ? copy.finish : copy.continue}</button>
            </div>
          </motion.section>
        ) : null}

        {phase === "final" ? (
          <motion.section className="cinematic-final" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="cinematic-final-scroll">
              <p>{map.finalMessage || copy.finalFallback}</p>
            </div>
            <button className="btn-secondary" type="button" onClick={() => flyToMemory(0)}>{copy.start}</button>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <section className="memory-dock cinematic-dock" aria-label={copy.memories}>
        {map.points.map((point, index) => (
          <button className={`memory-dock-card ${index === activeIndex ? "active" : ""}`} key={point.id} type="button" onClick={() => flyToMemory(index)}>
            {point.media_url ? point.media_type === "video" ? <video src={point.media_url} muted playsInline /> : <img src={point.media_url} alt={point.title || point.place_name} /> : <span className="memory-placeholder" />}
            <span>
              <strong>{point.title || point.place_name}</strong>
              <small>{point.place_name}</small>
            </span>
          </button>
        ))}
      </section>

      {showQr && canShowQr ? (
        <div className="qr-panel cinematic-qr-panel" ref={qrRef}>
          <QRCodeCanvas value={publicUrl} size={220} level="H" includeMargin />
          <button className="btn-secondary" type="button" onClick={downloadQrCode}>{copy.downloadQr}</button>
        </div>
      ) : null}
    </main>
  );
}
