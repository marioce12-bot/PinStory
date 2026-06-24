"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import type { Locale } from "@/lib/i18n";

function copyFor(lang: Locale) {
  if (lang === "ar") {
    return {
      title: "رابط و رمز QR جاهزان",
      description: "احفظ الرابط أو حمّل رمز QR قبل إرسال الألبوم. بعد ذلك يمكنك فتح تجربة الذكريات.",
      copy: "نسخ الرابط",
      copied: "تم النسخ",
      download: "تحميل رمز QR",
      open: "فتح الألبوم",
      missing: "معرّف الألبوم غير موجود.",
    };
  }

  if (lang === "en") {
    return {
      title: "Your link and QR Code are ready",
      description: "Save the link or download the QR Code before sharing the album. Then open the cinematic memory experience.",
      copy: "Copy link",
      copied: "Copied",
      download: "Download QR Code",
      open: "Open album",
      missing: "Missing album id.",
    };
  }

  return {
    title: "Votre lien et QR Code sont prêts",
    description: "Sauvegardez le lien ou téléchargez le QR Code avant de partager l’album. Ensuite, ouvrez l’expérience souvenir.",
    copy: "Copier le lien",
    copied: "Copié",
    download: "Télécharger le QR Code",
    open: "Ouvrir l’album",
    missing: "Identifiant d’album manquant.",
  };
}

export function SharePanel({ lang, mapId }: { lang: Locale; mapId?: string }) {
  const qrRef = useRef<HTMLDivElement | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const t = copyFor(lang);

  useEffect(() => {
    if (!mapId) return;

    const frame = window.requestAnimationFrame(() => {
      setPublicUrl(`${window.location.origin}/map/${mapId}`);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mapId]);

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas || !mapId) return;

    const link = document.createElement("a");
    link.download = `pinstory-${mapId}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  if (!mapId) {
    return <p className="section-copy">{t.missing}</p>;
  }

  return (
    <section className="share-panel">
      <div>
        <h1 className="section-title">{t.title}</h1>
        <p className="section-copy">{t.description}</p>
      </div>

      <div className="share-card">
        <div className="share-qr" ref={qrRef}>
          {publicUrl ? <QRCodeCanvas value={publicUrl} size={260} level="H" includeMargin /> : null}
        </div>
        <label className="form-field" htmlFor="share-url">
          <span>URL</span>
          <input id="share-url" value={publicUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
        </label>
        <div className="hero-actions">
          <button className="btn-secondary" type="button" onClick={() => void copyLink()}>
            {copied ? t.copied : t.copy}
          </button>
          <button className="btn-cta" type="button" onClick={downloadQr}>
            {t.download}
          </button>
          <Link className="btn-secondary" href={`/map/${mapId}`}>
            {t.open}
          </Link>
        </div>
      </div>
    </section>
  );
}
