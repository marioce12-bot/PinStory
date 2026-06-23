export type AudioTrack = {
  id: string;
  title: string;
  genre: string;
  url: string;
};

export const audioCatalog: AudioTrack[] = [
  {
    id: "tiak_style",
    title: "Mélo Wavy (Style Tiakola)",
    genre: "Afro / Chill",
    url: process.env.NEXT_PUBLIC_AUDIO_TIAK_URL || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    id: "aya_style",
    title: "Acoustic Pop (Style Aya)",
    genre: "Zouk / Pop",
    url: process.env.NEXT_PUBLIC_AUDIO_AYA_URL || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    id: "niska_style",
    title: "Gros Banger (Style Niska)",
    genre: "Trap / Énergie",
    url: process.env.NEXT_PUBLIC_AUDIO_NISKA_URL || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
  {
    id: "soft_piano",
    title: "Piano Doux",
    genre: "Calme / Romantique",
    url: process.env.NEXT_PUBLIC_AUDIO_SOFT_PIANO_URL || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  },
  {
    id: "soft_love",
    title: "Love Memories",
    genre: "Doux / Émotion",
    url: process.env.NEXT_PUBLIC_AUDIO_SOFT_LOVE_URL || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  },
  {
    id: "soft_cinematic",
    title: "Cinematic Soft",
    genre: "Cinématique / Lent",
    url: process.env.NEXT_PUBLIC_AUDIO_SOFT_CINEMATIC_URL || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
  },
];

export function getAudioTrackByUrl(url?: string | null) {
  if (!url) return null;
  return audioCatalog.find((track) => track.url === url) || null;
}
