"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { QRCodeCanvas } from "qrcode.react";
import { getMapboxStyle, PLAN_LIMITS } from "@/lib/plans";
import type { MemoryMap } from "@/lib/types";

type Dictionary = typeof import("@/dictionaries/fr.json");

function getDirectionsUrl(point: MemoryMap["points"][number]) {
  const destination = point.place_name || `${point.latitude},${point.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function popupHtml(point: MemoryMap["points"][number]) {
  const media = point.media_url
    ? `<div class="popup-media-wrapper">${
        point.media_type === "video"
          ? `<video src="${point.media_url}" controls></video>`
          : `<img src="${point.media_url}" alt="${point.title}" />`
      }</div>`
    : `<div class="popup-media-wrapper"></div>`;

  return `
    <article class="popup-animated">
      ${media}
      <div class="popup-text-content">
        <h3 class="popup-title">${point.title}</h3>
        <p class="popup-date">${point.date || ""}</p>
        <p class="popup-place">${point.place_name}</p>
        <p>${point.description}</p>
        <a class="directions-link" href="${getDirectionsUrl(point)}" target="_blank" rel="noopener noreferrer">
          Get Directions
        </a>
      </div>
    </article>
  `;
}

export function MapViewer({ map, dictionary }: { map: MemoryMap; dictionary: Dictionary }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const currentPoint = map.points[activeIndex] || map.points[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.pinstory.app";
  const publicUrl = `${appUrl}/map/${map.id}`;

  useEffect(() => {
    if (!containerRef.current || !mapboxToken || mapRef.current || map.points.length === 0) return;

    mapboxgl.accessToken = mapboxToken;
    const firstPoint = map.points[0];
    const instance = new mapboxgl.Map({
      container: containerRef.current,
      style: getMapboxStyle(map.theme_style),
      center: [firstPoint.longitude, firstPoint.latitude],
      zoom: 11,
    });

    map.points.forEach((point, index) => {
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className = `custom-marker ${index === activeIndex ? "marker-active" : ""}`;
      markerElement.setAttribute("aria-label", point.title);
      markerElement.addEventListener("click", () => setActiveIndex(index));

      new mapboxgl.Marker(markerElement)
        .setLngLat([point.longitude, point.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(popupHtml(point)))
        .addTo(instance);
    });

    instance.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    mapRef.current = instance;

    return () => {
      instance.remove();
      mapRef.current = null;
    };
  }, [activeIndex, map.points, map.theme_style, mapboxToken]);

  useEffect(() => {
    if (!mapRef.current || !currentPoint) return;
    mapRef.current.flyTo({ center: [currentPoint.longitude, currentPoint.latitude], zoom: 12, essential: true });
  }, [currentPoint]);

  function nextPoint() {
    setActiveIndex((index) => (index + 1) % map.points.length);
  }

  function previousPoint() {
    setActiveIndex((index) => (index - 1 + map.points.length) % map.points.length);
  }

  return (
    <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {mapboxToken ? <div ref={containerRef} className="map-container-fullscreen" /> : <div className="map-fallback" />}
      <div className="map-ui-overlay">
        <header className="ui-card-header">
          <p className="popup-date">PinStory</p>
          <h1 className="popup-title">{map.title}</h1>
          <p>{map.message}</p>
        </header>

        <section className="ui-card-controls" aria-label="Map controls">
          <div>
            <strong>{currentPoint?.title}</strong>
            <p className="popup-date">{currentPoint?.date}</p>
            <p className="popup-place">{currentPoint?.place_name}</p>
          </div>
          <button className="btn-secondary" type="button" onClick={previousPoint}>
            {dictionary.map.previous_point}
          </button>
          <button className="btn-cta" type="button" onClick={nextPoint}>
            {PLAN_LIMITS[map.plan].slideshow ? dictionary.map.mode_diaporama : dictionary.map.next_point}
          </button>
          {PLAN_LIMITS[map.plan].qrCode ? (
            <button className="btn-secondary" type="button" onClick={() => setShowQr((value) => !value)}>
              {dictionary.map.open_qr}
            </button>
          ) : null}
          {currentPoint ? (
            <a className="btn-secondary directions-button" href={getDirectionsUrl(currentPoint)} target="_blank" rel="noopener noreferrer">
              {map.lang === "en" ? "Get Directions" : "S'y rendre"}
            </a>
          ) : null}
          {showQr ? (
            <div style={{ padding: "0.75rem", background: "white", borderRadius: "var(--radius-md)" }}>
              <QRCodeCanvas value={publicUrl} size={160} level="H" includeMargin />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
