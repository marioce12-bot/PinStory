"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";

export function BackgroundMusic({ audioUrl, lang }: { audioUrl?: string; lang: Locale }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const isArabic = lang === "ar";
  const isEnglish = lang === "en";

  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audio.loop = true;
    audio.volume = 0.45;
    audioRef.current = audio;

    const startOnInteraction = async () => {
      setHasInteracted(true);
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    };

    window.addEventListener("pointerdown", startOnInteraction, { once: true });
    window.addEventListener("keydown", startOnInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", startOnInteraction);
      window.removeEventListener("keydown", startOnInteraction);
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  if (!audioUrl) return null;

  async function toggleAudio() {
    const audio = audioRef.current;
    if (!audio) return;

    setHasInteracted(true);

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }

  return (
    <button className={`music-floating-button ${isPlaying ? "playing" : ""}`} type="button" onClick={() => void toggleAudio()}>
      <span aria-hidden="true">{isPlaying ? "🔊" : "🔇"}</span>
      <span>
        {isPlaying
          ? isArabic
            ? "إيقاف الموسيقى"
            : isEnglish
              ? "Mute music"
              : "Couper la musique"
          : hasInteracted
            ? isArabic
              ? "تشغيل الموسيقى"
              : isEnglish
                ? "Play music"
                : "Lancer la musique"
            : isArabic
              ? "اكتشف مع الموسيقى"
              : isEnglish
                ? "Discover with music"
                : "Découvrir en musique"}
      </span>
    </button>
  );
}
