"use client";

import { useEffect, useRef, useState } from "react";
import { audioCatalog } from "@/config/audioCatalog";
import type { Locale } from "@/lib/i18n";

export function AudioSelector({
  lang,
  selectedUrl,
  onSelect,
}: {
  lang: Locale;
  selectedUrl: string;
  onSelect: (url: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  const isArabic = lang === "ar";
  const isEnglish = lang === "en";

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  function stopPreview() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingTrackId(null);
  }

  async function togglePreview(track: (typeof audioCatalog)[number]) {
    if (playingTrackId === track.id) {
      stopPreview();
      return;
    }

    stopPreview();
    const audio = new Audio(track.url);
    audio.volume = 0.55;
    audioRef.current = audio;
    setPlayingTrackId(track.id);

    audio.onended = () => setPlayingTrackId(null);

    try {
      await audio.play();
    } catch {
      setPlayingTrackId(null);
    }
  }

  return (
    <section className="audio-selector" aria-label={isArabic ? "اختيار الموسيقى" : isEnglish ? "Music selector" : "Sélection de musique"}>
      <div>
        <h2>{isArabic ? "موسيقى الخلفية" : isEnglish ? "Background music" : "Musique d’ambiance"}</h2>
        <p className="field-hint">
          {isArabic
            ? "اختر موسيقى قصيرة لألبومك، مثل قصص Instagram."
            : isEnglish
              ? "Choose a short mood track for your album, like Instagram Stories."
              : "Choisissez une ambiance sonore pour votre album, façon Stories Instagram."}
        </p>
      </div>

      <div className="audio-track-list">
        <button
          className={`audio-track-card ${selectedUrl === "" ? "active" : ""}`}
          type="button"
          onClick={() => {
            stopPreview();
            onSelect("");
          }}
        >
          <span className="audio-track-icon" aria-hidden="true">♪</span>
          <span>
            <strong>{isArabic ? "بدون موسيقى" : isEnglish ? "No music" : "Sans musique"}</strong>
            <small>{isArabic ? "ألبوم صامت" : isEnglish ? "Silent album" : "Album silencieux"}</small>
          </span>
        </button>

        {audioCatalog.map((track) => (
          <article className={`audio-track-card ${selectedUrl === track.url ? "active" : ""}`} key={track.id}>
            <button className="audio-preview-button" type="button" onClick={() => void togglePreview(track)}>
              {playingTrackId === track.id ? "❚❚" : "▶"}
            </button>
            <span>
              <strong>{track.title}</strong>
              <small>{track.genre}</small>
            </span>
            <button
              className="audio-choose-button"
              type="button"
              onClick={() => {
                onSelect(track.url);
              }}
            >
              {selectedUrl === track.url
                ? isArabic
                  ? "مختارة"
                  : isEnglish
                    ? "Selected"
                    : "Choisie"
                : isArabic
                  ? "اختيار"
                  : isEnglish
                    ? "Choose"
                    : "Choisir"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
