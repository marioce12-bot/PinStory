export const PLAN_LIMITS = {
  free: {
    price: 0,
    maxPoints: 3,
    media: true,
    images: true,
    videos: false,
    qrCode: true,
    customQrLogo: false,
    slideshow: false,
    durationDays: 14,
    themes: ["minimalist"],
  },
  mini: {
    price: 200,
    maxPoints: 5,
    media: true,
    images: true,
    videos: false,
    qrCode: true,
    customQrLogo: false,
    slideshow: false,
    durationDays: 30,
    themes: ["minimalist", "pastel"],
  },
  souvenir: {
    price: 500,
    maxPoints: 10,
    media: true,
    images: true,
    videos: false,
    qrCode: true,
    customQrLogo: false,
    slideshow: false,
    durationDays: 180,
    themes: ["minimalist", "pastel", "dark-luxe"],
  },
  eternal: {
    price: 3300,
    maxPoints: Number.POSITIVE_INFINITY,
    media: true,
    images: true,
    videos: true,
    qrCode: true,
    customQrLogo: true,
    slideshow: true,
    durationDays: null,
    themes: ["minimalist", "pastel", "dark-luxe", "premium-gold"],
  },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;
export type ThemeStyle = "minimalist" | "pastel" | "dark-luxe" | "premium-gold";

export function isPlan(value: string): value is Plan {
  return value === "free" || value === "mini" || value === "souvenir" || value === "eternal";
}

export function getPlanExpiry(plan: Plan, createdAt = new Date()) {
  const durationDays = PLAN_LIMITS[plan].durationDays;
  if (durationDays === null) return null;
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + durationDays);
  return expiresAt.toISOString();
}

export function getMapboxStyle(theme: string) {
  switch (theme) {
    case "dark-luxe":
      return "mapbox://styles/mapbox/dark-v11";
    case "pastel":
      return "mapbox://styles/mapbox/light-v11";
    case "premium-gold":
      return "mapbox://styles/mapbox/navigation-night-v1";
    case "minimalist":
    default:
      return "mapbox://styles/mapbox/streets-v12";
  }
}
