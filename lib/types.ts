import type { Locale } from "@/lib/i18n";
import type { Plan, ThemeStyle } from "@/lib/plans";

export type MemoryPoint = {
  id: string;
  order: number;
  title: string;
  date?: string;
  description: string;
  place_name: string;
  location_query?: string;
  longitude: number;
  latitude: number;
  media_url?: string;
  media_type?: "image" | "video";
};

export type MemoryMap = {
  id: string;
  client_email: string;
  lang: Locale;
  plan: Plan;
  theme_style: ThemeStyle;
  title: string;
  message: string;
  created_at: string;
  expires_at: string | null;
  payment_status: "pending" | "paid" | "failed" | "free";
  qr_code_url?: string;
  custom_qr_logo_url?: string;
  points: MemoryPoint[];
};
