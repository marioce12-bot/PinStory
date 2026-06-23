"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { QRCodeCanvas } from "qrcode.react";
import { getMapboxStyle, PLAN_LIMITS } from "@/lib/plans";
import type { MemoryMap } from "@/lib/types";

type Dictionary = typeof import("@/dictionaries/fr.json");

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDirectionsUrl(point: MemoryMap["points"][number]) {
  const destination = point.place_name || `${point.latitude},${point.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function popupHtml(point: MemoryMap["points"][number], lang: MemoryMap["lang"]) {
  const title = escapeHtml(point.title || point.place_name);
  const place = escapeHtml(point.place_name);
  const description = escapeHtml(point.description || "");
  const date = escapeHtml(point.date || "");
  const mediaUrl = point.media_url ? escapeHtml(point.media_url) : "";
  const directionsLabel = lang === "en" ? "Get Directions" : "S'y rendre";
  const media = mediaUrl
    ? `<div class="popup-media-wrapper">${
        point.media_type === "video"
          ? `<video src="${mediaUrl}" controls></video>`
          : `<img src="${mediaUrl}" alt="${title}" />`
      }</div>`
    : `<div class="popup-media-wrapper"></div>`;

  return `
    <article class="popup-animated">
      ${media}
      <div class="popup-text-content">
        <h3 class="popup-title">${title}</h3>
        <p class="popup-date">${date}</p>
        <p class="popup-place">${place}</p>
        <p>${description}</p>
        <a class="directions-link" href="${getDirectionsUrl(point)}" target="_blank" rel="noopener noreferrer">
          ${directionsLabel}
        </a>
      </div>
    </article>
  `;
}

export function MapViewer({ map, dictionary }: { map: MemoryMap; dictionary: Dictionary }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const qrRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<HTMLElement[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const currentPoint = map.points[activeIndex] || map.points[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.pinstory.app";
  const publicUrl = `${appUrl}/map/${map.id}`;
  const canShowQr = PLAN_LIMITS[map.plan].qrCode;

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

    markersRef.current = map.points.map((point, index) => {
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className = `custom-marker ${index === activeIndex ? "marker-active" : ""}`;
      markerElement.setAttribute("aria-label", point.title || point.place_name);
      markerElement.addEventListener("click", () => setActiveIndex(index));

      new mapboxgl.Marker(markerElement)
        .setLngLat([point.longitude, point.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(popupHtml(point, map.lang)))
        .addTo(instance);

      return markerElement;
    });

    instance.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    mapRef.current = instance;

    return () => {
      instance.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [activeIndex, map.lang, map.points, map.theme_style, mapboxToken]);

  useEffect(() => {
    markersRef.current.forEach((marker, index) => {
      marker.classList.toggle("marker-active", index === activeIndex);
    });

    if (!mapRef.current || !currentPoint) return;
    mapRef.current.flyTo({ center: [currentPoint.longitude, currentPoint.latitude], zoom: 12, essential: true });
  }, [activeIndex, currentPoint]);

  function nextPoint() {
    if (map.points.length === 0) return;
    setActiveIndex((index) => (index + 1) % map.points.length);
  }

  function previousPoint() {
    if (map.points.length === 0) return;
    setActiveIndex((index) => (index - 1 + map.points.length) % map.points.length);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopyStatus(map.lang === "en" ? "Link copied" : "Lien copié");
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

  return (
    <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {mapboxToken ? <div ref={containerRef} className="map-container-fullscreen" /> : <div className="map-fallback" />}

      {!mapboxToken ? (
        <div className="map-fallback-markers" aria-hidden="true">
          {map.points.slice(0, 8).map((point, index) => (
            <button
              className={`fallback-marker ${index === activeIndex ? "marker-active" : ""}`}
              key={point.id}
              style={{ left: `${18 + ((index * 19) % 62)}%`, top: `${22 + ((index * 17) % 56)}%` }}
              type="button"
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      ) : null}

      <div className="map-ui-overlay">
        <header className="ui-card-header map-header-card">
          <div>
            <p className="popup-date">PinStory</p>
            <h1 className="popup-title">{map.title}</h1>
            <p>{map.message}</p>
          </div>
          <div className="map-link-actions">
            <button className="btn-secondary" type="button" onClick={copyLink}>
              {map.lang === "en" ? "Copy link" : "Copier le lien"}
            </button>
            {canShowQr ? (
              <button className="btn-secondary" type="button" onClick={() => setShowQr((value) => !value)}>
                {dictionary.map.open_qr}
              </button>
            ) : null}
            {copyStatus ? <span className="copy-status">{copyStatus}</span> : null}
          </div>
        </header>

        <section className="memory-dock" aria-label={map.lang === "en" ? "Memories" : "Souvenirs"}>
          {map.points.map((point, index) => (
            <button
              className={`memory-dock-card ${index === activeIndex ? "active" : ""}`}
              key={point.id}
              type="button"
              onClick={() => setActiveIndex(index)}
            >
              {point.media_url ? (
                point.media_type === "video" ? (
                  <video src={point.media_url} muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={point.media_url} alt={point.title || point.place_name} />
                )
              ) : (
                <span className="memory-placeholder" />
              )}
              <span>
                <strong>{point.title || point.place_name}</strong>
                <small>{point.place_name}</small>
              </span>
            </button>
          ))}
        </section>

        <section className="ui-card-controls" aria-label="Map controls">
          <div className="active-memory-summary">
            {currentPoint?.media_url ? (
              <div className="active-memory-media">
                {currentPoint.media_type === "video" ? (
                  <video src={currentPoint.media_url} controls />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentPoint.media_url} alt={currentPoint.title || currentPoint.place_name} />
                )}
              </div>
            ) : null}
            <div>
              <strong>{currentPoint?.title}</strong>
              <p className="popup-date">{currentPoint?.date}</p>
              <p className="popup-place">{currentPoint?.place_name}</p>
              <p>{currentPoint?.description}</p>
            </div>
          </div>

          <div className="map-control-buttons">
            <button className="btn-secondary" type="button" onClick={previousPoint}>
              {dictionary.map.previous_point}
            </button>
            <button className="btn-cta" type="button" onClick={nextPoint}>
              {PLAN_LIMITS[map.plan].slideshow ? dictionary.map.mode_diaporama : dictionary.map.next_point}
            </button>
            {currentPoint ? (
              <a className="btn-secondary directions-button" href={getDirectionsUrl(currentPoint)} target="_blank" rel="noopener noreferrer">
                {map.lang === "en" ? "Get Directions" : "S'y rendre"}
              </a>
            ) : null}
          </div>

          {showQr && canShowQr ? (
            <div className="qr-panel" ref={qrRef}>
              <QRCodeCanvas value={publicUrl} size={220} level="H" includeMargin />
              <button className="btn-secondary" type="button" onClick={downloadQrCode}>
                {map.lang === "en" ? "Download QR" : "Télécharger le QR"}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
