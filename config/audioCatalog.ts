export type AudioTrack = {
  id: string;
  title: string;
  genre: string;
  url: string;
};

const firebaseStorageBase = "https://firebasestorage.googleapis.com/v0/b/my-instants-74d3e.firebasestorage.app/o";

export const audioCatalog: AudioTrack[] = [
  {
    id: "tiak_style",
    title: "Mélo Wavy (Style Tiakola)",
    genre: "Afro / Chill",
    url: `${firebaseStorageBase}/audio%2Ffond-wavy.mp3?alt=media`,
  },
  {
    id: "aya_style",
    title: "Acoustic Pop (Style Aya)",
    genre: "Zouk / Pop",
    url: `${firebaseStorageBase}/audio%2Fsunset-chill.mp3?alt=media`,
  },
  {
    id: "niska_style",
    title: "Gros Banger (Style Niska)",
    genre: "Trap / Énergie",
    url: `${firebaseStorageBase}/audio%2Fbanger.mp3?alt=media`,
  },
];

export function getAudioTrackByUrl(url?: string | null) {
  if (!url) return null;
  return audioCatalog.find((track) => track.url === url) || null;
}
