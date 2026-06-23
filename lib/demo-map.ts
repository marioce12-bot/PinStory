import type { Locale } from "@/lib/i18n";
import type { MemoryMap } from "@/lib/types";

export function getDemoMap(id: string, lang: Locale = "fr"): MemoryMap {
  const isEnglish = lang === "en";

  return {
    id,
    client_email: "demo@myinstantsmap.com",
    lang,
    plan: "eternal",
    theme_style: "dark-luxe",
    title: isEnglish ? "Our first journey" : "Notre premier voyage",
    message: isEnglish
      ? "A living map of the moments that changed everything."
      : "Une carte vivante des moments qui ont tout changé.",
    created_at: new Date().toISOString(),
    expires_at: null,
    payment_status: "paid",
    points: [
      {
        id: "p1",
        order: 1,
        title: isEnglish ? "The first coffee" : "Le premier café",
        date: "2024-05-12",
        description: isEnglish
          ? "A tiny table, heavy rain, and the start of the story."
          : "Une petite table, une pluie battante, et le début de l'histoire.",
        longitude: 2.3522,
        latitude: 48.8566,
      },
      {
        id: "p2",
        order: 2,
        title: isEnglish ? "The promise" : "La promesse",
        date: "2025-02-03",
        description: isEnglish
          ? "The city lights became our private constellation."
          : "Les lumières de la ville sont devenues notre constellation privée.",
        longitude: 2.2945,
        latitude: 48.8584,
      },
    ],
  };
}
