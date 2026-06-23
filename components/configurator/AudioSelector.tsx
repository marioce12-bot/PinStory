"use client";

import { useEffect, useRef, useState } from "react";
import { audioCatalog } from "@/config/audioCatalog";
import type { Locale } from "@/lib/i18n";

const AUDIO_UPLOAD_TIMEOUT_MS = 60000;

function uploadAudioWithProgress(file: File, onProgress: (percent: number) => void) {
  return new Promise<{ media_url?: string; error?: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const timeout = window.setTimeout(() => {
      request.abort();
      reject(new Error("Upload timeout"));
    }, AUDIO_UPLOAD_TIMEOUT_MS);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("plan", "audio");

    request.open("POST", "/api/upload");
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      window.clearTimeout(timeout);
      try {
        const payload = JSON.parse(request.responseText || "{}") as { media_url?: string; error?: string };
        if (request.status >= 200 && request.status < 300) {
          resolve(payload);
          return;
        }
        reject(new Error(payload.error || "Audio upload failed"));
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
  const [customAudioUrl, setCustomAudioUrl] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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

  async function uploadCustomAudio(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setUploadStatus(isArabic ? "اختر ملفاً صوتياً فقط." : isEnglish ? "Please choose an audio file." : "Choisissez uniquement un fichier audio.");
      return;
    }

    try {
      stopPreview();
      setIsUploading(true);
      setUploadStatus(isArabic ? "بدء رفع الموسيقى..." : isEnglish ? "Uploading music..." : "Upload de la musique...");
      const result = await uploadAudioWithProgress(file, (percent) => {
        setUploadStatus(isArabic ? `رفع الموسيقى... ${percent}%` : isEnglish ? `Uploading music... ${percent}%` : `Upload de la musique... ${percent}%`);
      });

      if (!result.media_url) {
        setUploadStatus(result.error || (isArabic ? "فشل رفع الموسيقى." : isEnglish ? "Music upload failed." : "L’upload de la musique a échoué."));
        return;
      }

      setCustomAudioUrl(result.media_url);
      onSelect(result.media_url);
      setUploadStatus(isArabic ? "تمت إضافة الموسيقى." : isEnglish ? "Music added." : "Musique ajoutée.");
      window.setTimeout(() => setUploadStatus(null), 1800);
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : isArabic ? "فشل رفع الموسيقى." : isEnglish ? "Music upload failed." : "L’upload de la musique a échoué.");
    } finally {
      setIsUploading(false);
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

        <article className={`audio-track-card custom-audio-card ${selectedUrl && selectedUrl === customAudioUrl ? "active" : ""}`}>
          <span className="audio-track-icon" aria-hidden="true">⬆</span>
          <span>
            <strong>{isArabic ? "ارفع موسيقاك" : isEnglish ? "Upload your music" : "Uploader votre musique"}</strong>
            <small>{isArabic ? "من الهاتف" : isEnglish ? "From your phone" : "Depuis votre téléphone"}</small>
          </span>
          <label className="audio-choose-button audio-upload-label">
            {isUploading ? "..." : isArabic ? "رفع" : isEnglish ? "Upload" : "Uploader"}
            <input type="file" accept="audio/*" disabled={isUploading} onChange={(event) => void uploadCustomAudio(event.target.files?.[0])} />
          </label>
          {uploadStatus ? <p className="field-hint audio-upload-status">{uploadStatus}</p> : null}
        </article>
      </div>
    </section>
  );
}
