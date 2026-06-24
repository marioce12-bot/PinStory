"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";

const VIDEO_AUDIO_UPLOAD_TIMEOUT_MS = 90000;

function uploadVideoWithProgress(file: File, onProgress: (percent: number) => void) {
  return new Promise<{ media_url?: string; error?: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const timeout = window.setTimeout(() => {
      request.abort();
      reject(new Error("Upload timeout"));
    }, VIDEO_AUDIO_UPLOAD_TIMEOUT_MS);

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
        reject(new Error(payload.error || "Video upload failed"));
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
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const isArabic = lang === "ar";
  const isEnglish = lang === "en";

  useEffect(() => {
    return () => {
      // Stop any playing preview when leaving the configurator.
      document.querySelectorAll<HTMLVideoElement>(".video-audio-preview video").forEach((video) => video.pause());
    };
  }, []);

  async function uploadVideoForMusic(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setUploadStatus(
        isArabic
          ? "اختر فيديو يحتوي على الموسيقى التي تريدها."
          : isEnglish
            ? "Choose a video that contains the music you want to use."
            : "Choisissez une vidéo contenant la musique à utiliser.",
      );
      return;
    }

    try {
      setIsUploading(true);
      setIsPreviewPlaying(false);
      setUploadStatus(isArabic ? "بدء رفع الفيديو..." : isEnglish ? "Uploading video..." : "Upload de la vidéo...");
      const result = await uploadVideoWithProgress(file, (percent) => {
        setUploadStatus(isArabic ? `رفع الفيديو... ${percent}%` : isEnglish ? `Uploading video... ${percent}%` : `Upload de la vidéo... ${percent}%`);
      });

      if (!result.media_url) {
        setUploadStatus(result.error || (isArabic ? "فشل رفع الفيديو." : isEnglish ? "Video upload failed." : "L’upload de la vidéo a échoué."));
        return;
      }

      setUploadedVideoUrl(result.media_url);
      onSelect(result.media_url);
      setUploadStatus(
        isArabic
          ? "تمت إضافة صوت الفيديو كموسيقى للخلفية."
          : isEnglish
            ? "The video's audio was added as background music."
            : "Le son de la vidéo a été ajouté comme musique d’ambiance.",
      );
      window.setTimeout(() => setUploadStatus(null), 2200);
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : isArabic ? "فشل رفع الفيديو." : isEnglish ? "Video upload failed." : "L’upload de la vidéo a échoué.");
    } finally {
      setIsUploading(false);
    }
  }

  async function togglePreview() {
    const media = mediaRef.current;
    if (!media) return;

    if (isPreviewPlaying) {
      media.pause();
      setIsPreviewPlaying(false);
      return;
    }

    try {
      media.muted = false;
      media.volume = 0.65;
      await media.play();
      setIsPreviewPlaying(true);
    } catch {
      setIsPreviewPlaying(false);
    }
  }

  const hasVideoMusic = Boolean(uploadedVideoUrl || selectedUrl);
  const previewUrl = uploadedVideoUrl || selectedUrl;

  return (
    <section className="audio-selector" aria-label={isArabic ? "اختيار موسيقى من فيديو" : isEnglish ? "Video music selector" : "Sélection de musique depuis une vidéo"}>
      <div>
        <h2>{isArabic ? "موسيقى الخلفية" : isEnglish ? "Background music" : "Musique d’ambiance"}</h2>
        <p className="field-hint">
          {isArabic
            ? "اختر فيديو من هاتفك يحتوي على الموسيقى التي تريد استخدامها لذكرياتك. سنستخدم صوت الفيديو فقط كخلفية."
            : isEnglish
              ? "Choose a video from your phone that contains the music to use for your memories. We will use the video's sound as background audio."
              : "Choisissez une vidéo depuis votre téléphone contenant la musique à utiliser pour vos souvenirs. Nous utiliserons le son de la vidéo en arrière-plan."}
        </p>
      </div>

      <div className="audio-track-list">
        <button
          className={`audio-track-card ${selectedUrl === "" ? "active" : ""}`}
          type="button"
          onClick={() => {
            mediaRef.current?.pause();
            setIsPreviewPlaying(false);
            setUploadedVideoUrl("");
            onSelect("");
          }}
        >
          <span className="audio-track-icon" aria-hidden="true">♪</span>
          <span>
            <strong>{isArabic ? "بدون موسيقى" : isEnglish ? "No music" : "Sans musique"}</strong>
            <small>{isArabic ? "ألبوم صامت" : isEnglish ? "Silent album" : "Album silencieux"}</small>
          </span>
        </button>

        <article className={`audio-track-card custom-audio-card ${hasVideoMusic ? "active" : ""}`}>
          <span className="audio-track-icon" aria-hidden="true">🎥</span>
          <span>
            <strong>{isArabic ? "اختيار فيديو للموسيقى" : isEnglish ? "Choose a music video" : "Choisir une vidéo musicale"}</strong>
            <small>{isArabic ? "سنستخدم صوت الفيديو فقط" : isEnglish ? "Only the video's audio will be used" : "Seul le son de la vidéo sera utilisé"}</small>
          </span>
          <label className="audio-choose-button audio-upload-label">
            {isUploading ? "..." : isArabic ? "اختيار" : isEnglish ? "Choose" : "Choisir"}
            <input type="file" accept="video/*" disabled={isUploading} onChange={(event) => void uploadVideoForMusic(event.target.files?.[0])} />
          </label>
          {previewUrl ? (
            <div className="video-audio-preview">
              <video ref={mediaRef} src={previewUrl} playsInline onEnded={() => setIsPreviewPlaying(false)} />
              <button className="btn-secondary" type="button" onClick={() => void togglePreview()}>
                {isPreviewPlaying
                  ? isArabic
                    ? "إيقاف المعاينة"
                    : isEnglish
                      ? "Pause preview"
                      : "Pause extrait"
                  : isArabic
                    ? "سماع الصوت"
                    : isEnglish
                      ? "Preview sound"
                      : "Écouter le son"}
              </button>
            </div>
          ) : null}
          {uploadStatus ? <p className="field-hint audio-upload-status">{uploadStatus}</p> : null}
        </article>
      </div>
    </section>
  );
}
