import { isLocale } from "@/lib/i18n";
import { isPlan, PLAN_LIMITS, type Plan, type ThemeStyle } from "@/lib/plans";
import type { MemoryPoint } from "@/lib/types";

export function validateMapPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { ok: false as const, error: "Invalid payload." };
  }

  const data = payload as Record<string, unknown>;
  const plan = String(data.plan || "free");
  const lang = String(data.lang || "fr");
  const theme = String(data.theme_style || "minimalist") as ThemeStyle;
  const points = Array.isArray(data.points) ? (data.points as MemoryPoint[]) : [];

  if (!isPlan(plan)) return { ok: false as const, error: "Unknown plan." };
  if (!isLocale(lang)) return { ok: false as const, error: "Unknown language." };
  if (!PLAN_LIMITS[plan].themes.includes(theme as never)) {
    return { ok: false as const, error: "Theme is not available for this plan." };
  }
  if (points.length === 0) return { ok: false as const, error: "At least one point is required." };
  if (points.length > PLAN_LIMITS[plan].maxPoints) {
    return { ok: false as const, error: "Too many points for this plan." };
  }

  for (const point of points) {
    if (!point.place_name || typeof point.longitude !== "number" || typeof point.latitude !== "number") {
      return { ok: false as const, error: "Every memory needs a place." };
    }

    if (plan !== "free" && !point.media_url) {
      return { ok: false as const, error: "A photo or video is required for each paid memory." };
    }

    if (point.media_type && !PLAN_LIMITS[plan].media) {
      return { ok: false as const, error: "Media is not available for this plan." };
    }

    if (point.media_type === "video" && !PLAN_LIMITS[plan].videos) {
      return { ok: false as const, error: "Videos require the Eternal plan." };
    }
  }

  return { ok: true as const, plan: plan as Plan, lang, theme, points };
}
