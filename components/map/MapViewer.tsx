"use client";

/* eslint-disable @next/next/no-img-element */

import "maplibre-gl/dist/maplibre-gl.css";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import * as THREE from "three";
import { BackgroundMusic } from "@/components/map/BackgroundMusic";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { getMapTilerStyle } from "@/lib/plans";
import type { MemoryMap } from "@/lib/types";

type Dictionary = typeof import("@/dictionaries/fr.json");
type ExperienceAct = "locked" | "ready" | "space" | "clouds" | "flash" | "map" | "modal" | "final";

const UNSPLASH_FLASH_IMAGES = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=480&q=60",
  "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=480&q=60",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=480&q=60",
  "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=480&q=60",
  "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=480&q=60",
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=480&q=60",
  "https://images.unsplash.com/photo-1470115636492-6d2b56f9146d?auto=format&fit=crop&w=480&q=60",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=480&q=60",
];

function getDirectionsUrl(point: MemoryMap["points"][number]) {
  const destination = point.place_name || `${point.latitude},${point.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function getCopy(lang: MemoryMap["lang"]) {
  if (lang === "ar") {
    return {
      start: "ابدأ الرحلة",
      skip: "تخطي",
      tapPin: "اضغط على الدبوس المضيء لفتح الذكرى",
      continue: "متابعة الرحلة",
      finish: "إنهاء الرحلة",
      replay: "إعادة الرحلة",
      directions: "اذهب إلى الذكرى",
      privateAlbum: "ألبوم خاص",
      enterCode: "أدخل الرمز السري لفتح هذا PinStory.",
      codePlaceholder: "الرمز السري",
      wrongCode: "الرمز السري غير صحيح.",
      openAlbum: "فتح الألبوم",
      finalFallback: "شكراً لأنك عشت هذه الرحلة معنا. هذه الذكريات ستبقى دائماً قريبة من القلب.",
      giftCtaTitle: "اصنع أنت أيضاً ذكرى جميلة",
      giftCtaText: "أنشئ PinStory وقدّمه لشخص قريب منك كهدية لا تُنسى.",
      giftCtaButton: "إنشاء ذكرى كهدية",
    };
  }

  if (lang === "en") {
    return {
      start: "Start the journey",
      skip: "Skip",
      tapPin: "Tap the glowing pin to open the memory",
      continue: "Continue the journey",
      finish: "End the journey",
      replay: "Replay the journey",
      directions: "Get Directions",
      privateAlbum: "Private album",
      enterCode: "Enter the secret code to open this PinStory.",
      codePlaceholder: "Secret code",
      wrongCode: "Incorrect secret code.",
      openAlbum: "Open album",
      finalFallback: "Thank you for reliving this journey with us. These memories will always stay close to our hearts.",
      giftCtaTitle: "Create your own memory too",
      giftCtaText: "Make a PinStory and offer it to someone you love as a meaningful gift.",
      giftCtaButton: "Create a memory gift",
    };
  }

  return {
    start: "Commencer le voyage",
    skip: "Passer",
    tapPin: "Appuyez sur le pin lumineux pour ouvrir le souvenir",
    continue: "Continuer le voyage",
    finish: "Terminer le voyage",
    replay: "Refaire le voyage",
    directions: "S’y rendre",
    privateAlbum: "Album privé",
    enterCode: "Entrez le code secret pour ouvrir ce PinStory.",
    codePlaceholder: "Code secret",
    wrongCode: "Code secret incorrect.",
    openAlbum: "Ouvrir l’album",
    finalFallback: "Merci d’avoir revécu ce voyage avec nous. Ces souvenirs resteront toujours près du cœur.",
    giftCtaTitle: "Créez aussi votre propre souvenir",
    giftCtaText: "Offrez à vos proches un PinStory personnalisé, comme celui que vous venez de découvrir.",
    giftCtaButton: "Créer un souvenir à offrir",
  };
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function SpaceGlobe() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(1.25, 64, 64);
    const material = new THREE.MeshStandardMaterial({
      color: 0x1e88e5,
      roughness: 0.6,
      metalness: 0.08,
      emissive: 0x06223a,
      emissiveIntensity: 0.35,
    });
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.285, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, wireframe: true }),
    );
    scene.add(clouds);

    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.position.set(3, 2, 4);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x7ac7ff, 0.8));

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      globe.rotation.y += 0.006;
      globe.rotation.x = Math.sin(Date.now() / 2400) * 0.05;
      clouds.rotation.y -= 0.003;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="three-globe" ref={mountRef} />;
}

export function MapViewer({ map }: { map: MemoryMap; dictionary: Dictionary }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<HTMLElement[]>([]);
  const timersRef = useRef<number[]>([]);
  const sequenceRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [act, setAct] = useState<ExperienceAct>(map.secret_code ? "locked" : "ready");
  const [secretInput, setSecretInput] = useState("");
  const [secretError, setSecretError] = useState<string | null>(null);
  const [fullscreenMedia, setFullscreenMedia] = useState<MemoryMap["points"][number] | null>(null);
  const isMobile = useIsMobile();
  const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const currentPoint = map.points[activeIndex] || map.points[0];
  const copy = useMemo(() => getCopy(map.lang), [map.lang]);
  const flashImages = useMemo(() => {
    const personalImages = map.points.map((point) => point.media_url).filter((url): url is string => Boolean(url));
    return [...personalImages, ...UNSPLASH_FLASH_IMAGES, ...personalImages, ...UNSPLASH_FLASH_IMAGES].slice(0, 30);
  }, [map.points]);

  useEffect(() => {
    flashImages.forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, [flashImages]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || map.points.length === 0) return;

    const firstPoint = map.points[0];
    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: getMapTilerStyle(map.theme_style, mapTilerKey),
      center: [firstPoint.longitude, firstPoint.latitude],
      zoom: 12,
      pitch: 0,
    });

    markersRef.current = map.points.map((point) => {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = "story-pin";
      marker.setAttribute("aria-label", point.title || point.place_name);
      marker.addEventListener("click", () => {
        if (!marker.classList.contains("active")) return;
        setAct("modal");
      });

      new maplibregl.Marker({ element: marker }).setLngLat([point.longitude, point.latitude]).addTo(instance);
      return marker;
    });

    mapRef.current = instance;

    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
      instance.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [map.points, map.theme_style, mapTilerKey]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreenMedia(null);
    };
    const handlePopState = () => setFullscreenMedia(null);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  function openFullscreenMedia(point: MemoryMap["points"][number]) {
    setFullscreenMedia(point);
    window.history.pushState({ pinstoryFullscreenMedia: true }, "");
  }

  function closeFullscreenMedia() {
    setFullscreenMedia(null);
  }

  useEffect(() => {
    markersRef.current.forEach((marker, index) => {
      marker.classList.toggle("active", index === activeIndex && act === "map");
      marker.classList.toggle("muted", index !== activeIndex);
    });
  }, [act, activeIndex]);

  function clearTimers() {
    sequenceRef.current += 1;
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function schedule(callback: () => void, delay: number, sequence = sequenceRef.current) {
    const timer = window.setTimeout(() => {
      if (sequenceRef.current !== sequence) return;
      callback();
    }, delay);
    timersRef.current.push(timer);
  }

  function cameraToPoint(index: number) {
    const point = map.points[index];
    if (!point || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [point.longitude, point.latitude],
      zoom: 15,
      pitch: 55,
      bearing: index % 2 === 0 ? 18 : -18,
      duration: isMobile ? 1200 : 1800,
      essential: true,
    });
  }

  function revealMap(index: number) {
    setActiveIndex(index);
    setAct("map");
    schedule(() => cameraToPoint(index), 250);
  }

  function runFullSequence(index = 0) {
    const factor = isMobile ? 0.7 : 1;
    clearTimers();
    const sequence = sequenceRef.current;
    setActiveIndex(index);
    setAct("space");
    schedule(() => setAct("clouds"), 3600 * factor, sequence);
    schedule(() => setAct("flash"), 6100 * factor, sequence);
    schedule(() => revealMap(index), 8500 * factor, sequence);
  }

  function restartJourney() {
    clearTimers();
    setActiveIndex(0);
    setAct("ready");

    if (mapRef.current && map.points[0]) {
      mapRef.current.jumpTo({
        center: [map.points[0].longitude, map.points[0].latitude],
        zoom: 3,
        pitch: 0,
        bearing: 0,
      });
    }

    window.requestAnimationFrame(() => {
      window.setTimeout(() => runFullSequence(0), 80);
    });
  }

  function runShortSequence(index: number) {
    const factor = isMobile ? 0.7 : 1;
    clearTimers();
    const sequence = sequenceRef.current;
    setActiveIndex(index);
    setAct("clouds");
    schedule(() => setAct("flash"), 1600 * factor, sequence);
    schedule(() => revealMap(index), 3200 * factor, sequence);
  }

  function skipToMap() {
    clearTimers();
    revealMap(activeIndex);
  }

  function continueJourney() {
    const nextIndex = activeIndex + 1;
    if (nextIndex < map.points.length) {
      runShortSequence(nextIndex);
      return;
    }

    setAct("final");
    if (mapRef.current && map.points.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      map.points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
      mapRef.current.fitBounds(bounds, { padding: 80, duration: 1800 });
    }
  }

  function unlockAlbum() {
    if (!map.secret_code || secretInput.trim() === map.secret_code) {
      setAct("ready");
      setSecretError(null);
      return;
    }
    setSecretError(copy.wrongCode);
  }

  if (act === "locked") {
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
          <button className="btn-cta" type="button" onClick={unlockAlbum}>{copy.openAlbum}</button>
        </div>
      </main>
    );
  }

  return (
    <main className={`story-experience act-${act}`}>
      <BackgroundMusic audioUrl={map.audioUrl} lang={map.lang} />
      <div className="story-map-stage">
        <div className="story-map-paper">
          <div className="map-container-fullscreen story-map-container" ref={containerRef} />
        </div>
      </div>

      <div className="cinematic-topbar">
        <BrandLogo href={`/${map.lang}`} />
        {act !== "ready" && act !== "map" && act !== "modal" && act !== "final" ? (
          <button className="skip-cinematic-button" type="button" onClick={skipToMap}>{copy.skip}</button>
        ) : null}
      </div>

      <AnimatePresence>
        {act === "ready" ? (
          <motion.section className="cinematic-intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}>{map.title}</motion.h1>
            <motion.button className="btn-cta" type="button" onClick={() => runFullSequence(0)} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
              {copy.start}
            </motion.button>
          </motion.section>
        ) : null}

        {act === "space" ? (
          <motion.section className="space-act" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="space-stars stars-a" />
            <div className="space-stars stars-b" />
            <motion.div className="space-globe-approach" initial={{ scale: 0.28, opacity: 0.7 }} animate={{ scale: 1.55, opacity: 1 }} transition={{ duration: isMobile ? 2.5 : 3.6, ease: "easeInOut" }}>
              <SpaceGlobe />
            </motion.div>
          </motion.section>
        ) : null}

        {act === "clouds" ? (
          <motion.section className="clouds-act" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="cloud-layer cloud-one" />
            <div className="cloud-layer cloud-two" />
            <div className="cloud-layer cloud-three" />
          </motion.section>
        ) : null}

        {act === "flash" ? (
          <motion.section className="flash-act" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {flashImages.map((src, index) => (
              <img
                alt=""
                className={`flash-image flash-${index % 8}`}
                key={`${src}-${index}`}
                src={src}
                style={{ animationDelay: `${index * 90}ms` }}
              />
            ))}
          </motion.section>
        ) : null}

        {act === "map" && currentPoint ? (
          <motion.button className="cinematic-location-prompt" type="button" onClick={() => setAct("modal")} initial={{ opacity: 0, x: "-50%", y: 26, scale: 0.86 }} animate={{ opacity: 1, x: "-50%", y: 0, scale: 1 }} exit={{ opacity: 0, x: "-50%", y: -16, scale: 0.94 }}>
            <span className="location-pin-icon" aria-hidden="true">⌖</span>
            <strong>{currentPoint.title || currentPoint.place_name}</strong>
            <small>{copy.tapPin}</small>
          </motion.button>
        ) : null}

        {act === "modal" && currentPoint ? (
          <motion.section className="cinematic-memory-modal" initial={{ opacity: 0, y: 36, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}>
            {currentPoint.media_url ? (
              <button className="cinematic-memory-media" type="button" onClick={() => openFullscreenMedia(currentPoint)} aria-label="Open media fullscreen">
                {currentPoint.media_type === "video" ? <video src={currentPoint.media_url} muted playsInline /> : <img src={currentPoint.media_url} alt={currentPoint.title || currentPoint.place_name} />}
              </button>
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

        {act === "final" ? (
          <motion.section className="cinematic-final" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="cinematic-final-scroll" tabIndex={0}>
              <p>{map.finalMessage || copy.finalFallback}</p>
            </div>
            <div className="cinematic-final-actions">
              <button className="btn-secondary" type="button" onClick={restartJourney}>{copy.replay}</button>
              <article className="recipient-gift-cta">
                <h2>{copy.giftCtaTitle}</h2>
                <p>{copy.giftCtaText}</p>
                <a className="btn-cta" href={`/${map.lang}`}>{copy.giftCtaButton}</a>
              </article>
            </div>
          </motion.section>
        ) : null}

        {fullscreenMedia?.media_url ? (
          <motion.section className="fullscreen-media-viewer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="fullscreen-media-close" type="button" onClick={closeFullscreenMedia} aria-label="Close fullscreen media">
              ×
            </button>
            <div className="fullscreen-media-content">
              {fullscreenMedia.media_type === "video" ? (
                <video src={fullscreenMedia.media_url} controls autoPlay playsInline />
              ) : (
                <img src={fullscreenMedia.media_url} alt={fullscreenMedia.title || fullscreenMedia.place_name} />
              )}
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
