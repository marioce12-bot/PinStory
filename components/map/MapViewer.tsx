"use client";

/* eslint-disable @next/next/no-img-element */

import "maplibre-gl/dist/maplibre-gl.css";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { BackgroundMusic } from "@/components/map/BackgroundMusic";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { getMapTilerStyle } from "@/lib/plans";
import type { MemoryMap } from "@/lib/types";

type Dictionary = typeof import("@/dictionaries/fr.json");
type StoryPhase = "locked" | "intro" | "flying" | "pin" | "modal" | "final";

function getDirectionsUrl(point: MemoryMap["points"][number]) {
  const destination = point.place_name || `${point.latitude},${point.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function getCopy(lang: MemoryMap["lang"]) {
  if (lang === "ar") {
    return {
      intro1: "استعد لرحلة صغيرة بين الذكريات...",
      intro2: "تدور الأرض... ثم نقترب من أول ذكرى.",
      start: "اكتشف الخريطة",
      tapPin: "اضغط على علامة الموقع لفتح الذكرى",
      continue: "متابعة الرحلة",
      finish: "إنهاء الرحلة",
      replay: "إعادة الرحلة",
      directions: "اذهب إلى الذكرى",
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
      intro2: "The globe turns... then we zoom into your first memory.",
      start: "Discover my map",
      tapPin: "Tap the location pin to open the memory",
      continue: "Continue the journey",
      finish: "End the journey",
      replay: "Replay the journey",
      directions: "Get Directions",
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
    intro2: "Le globe tourne... puis on plonge vers votre premier souvenir.",
    start: "Découvrir ma carte",
    tapPin: "Appuyez sur l’icône de localisation pour ouvrir le souvenir",
    continue: "Continuer le voyage",
    finish: "Terminer le voyage",
    replay: "Refaire le voyage",
    directions: "S’y rendre",
    privateAlbum: "Album privé",
    enterCode: "Entrez le code secret pour ouvrir ce PinStory.",
    codePlaceholder: "Code secret",
    wrongCode: "Code secret incorrect.",
    openAlbum: "Ouvrir l’album",
    memories: "Souvenirs",
    finalFallback: "Merci d’avoir revécu ce voyage avec nous. Ces souvenirs resteront toujours près du cœur.",
  };
}

export function MapViewer({ map }: { map: MemoryMap; dictionary: Dictionary }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<HTMLElement[]>([]);
  const flyTimeoutRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<StoryPhase>(map.secret_code ? "locked" : "intro");
  const [hasInteractiveMap, setHasInteractiveMap] = useState(false);
  const [secretInput, setSecretInput] = useState("");
  const [secretError, setSecretError] = useState<string | null>(null);
  const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const currentPoint = map.points[activeIndex] || map.points[0];
  const copy = useMemo(() => getCopy(map.lang), [map.lang]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || map.points.length === 0) return;

    const firstPoint = map.points[0];
    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: getMapTilerStyle(map.theme_style, mapTilerKey),
      center: [firstPoint.longitude, firstPoint.latitude],
      zoom: 3,
      pitch: 0,
    });

    instance.once("load", () => setHasInteractiveMap(true));
    instance.once("error", () => setHasInteractiveMap(false));

    markersRef.current = map.points.map((point, index) => {
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className = "custom-marker cinematic-marker";
      markerElement.setAttribute("aria-label", point.title || point.place_name);
      markerElement.addEventListener("click", () => {
        setActiveIndex(index);
        setPhase("modal");
      });

      new maplibregl.Marker({ element: markerElement }).setLngLat([point.longitude, point.latitude]).addTo(instance);
      return markerElement;
    });

    instance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    mapRef.current = instance;

    return () => {
      if (flyTimeoutRef.current) window.clearTimeout(flyTimeoutRef.current);
      instance.remove();
      mapRef.current = null;
      markersRef.current = [];
      setHasInteractiveMap(false);
    };
  }, [map.points, map.theme_style, mapTilerKey]);

  useEffect(() => {
    markersRef.current.forEach((marker, index) => {
      marker.classList.toggle("marker-active", index === activeIndex && (phase === "pin" || phase === "modal"));
    });
  }, [activeIndex, phase]);

  function revealMemory(index = activeIndex) {
    setActiveIndex(index);
    setPhase("modal");
  }

  function flyToMemory(index: number) {
    const point = map.points[index];
    if (!point) return;

    setActiveIndex(index);
    setPhase("flying");

    if (flyTimeoutRef.current) window.clearTimeout(flyTimeoutRef.current);

    if (mapRef.current) {
      mapRef.current.easeTo({
        zoom: 1.15,
        pitch: 0,
        bearing: 0,
        duration: 1400,
        essential: true,
      });

      window.setTimeout(() => {
        mapRef.current?.easeTo({
          center: [point.longitude, point.latitude],
          zoom: 2.15,
          pitch: 0,
          bearing: index % 2 === 0 ? 42 : -42,
          duration: 1800,
          essential: true,
        });
      }, 1150);

      window.setTimeout(() => {
        mapRef.current?.flyTo({
          center: [point.longitude, point.latitude],
          zoom: 15.8,
          duration: 3200,
          pitch: 45,
          bearing: index % 2 === 0 ? 26 : -26,
          essential: true,
        });
      }, 2850);

      flyTimeoutRef.current = window.setTimeout(() => setPhase("pin"), 6200);
    } else {
      flyTimeoutRef.current = window.setTimeout(() => setPhase("pin"), 1000);
    }
  }

  function startStory() {
    flyToMemory(0);
  }

  function continueJourney() {
    const nextIndex = activeIndex + 1;
    if (nextIndex < map.points.length) {
      flyToMemory(nextIndex);
      return;
    }

    setPhase("final");
    if (mapRef.current && map.points.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      map.points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
      mapRef.current.fitBounds(bounds, { padding: 90, duration: 3500, pitch: 0, bearing: 0 });
    }
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
    <main className={`cinematic-map-shell phase-${phase}`}>
      <BackgroundMusic audioUrl={map.audioUrl} lang={map.lang} />
      <div ref={containerRef} className="map-container-fullscreen" />

      {!hasInteractiveMap ? <div className="map-fallback" /> : null}

      {!hasInteractiveMap ? (
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
      </div>

      <AnimatePresence>
        {phase === "intro" ? (
          <motion.section className="cinematic-intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="cinematic-globe-wrap" initial={{ opacity: 0, scale: 0.78 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9 }} aria-hidden="true">
              <div className="cinematic-globe">
                <span className="globe-shine" />
              </div>
              <span className="globe-orbit orbit-one" />
              <span className="globe-orbit orbit-two" />
            </motion.div>
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

        {phase === "pin" && currentPoint ? (
          <motion.button className="cinematic-location-prompt" type="button" onClick={() => revealMemory()} initial={{ opacity: 0, y: 26, scale: 0.86 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.94 }}>
            <span className="location-pin-icon" aria-hidden="true">⌖</span>
            <strong>{currentPoint.title || currentPoint.place_name}</strong>
            <small>{copy.tapPin}</small>
          </motion.button>
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
            <div className="cinematic-final-scroll" tabIndex={0}>
              <p>{map.finalMessage || copy.finalFallback}</p>
            </div>
            <button className="btn-secondary" type="button" onClick={() => flyToMemory(0)}>{copy.replay}</button>
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

    </main>
  );
}
