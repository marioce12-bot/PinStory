import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";

type CloudinaryConfig = {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
  missing: string[];
};

function cleanEnvValue(value?: string) {
  return value?.trim().replace(/^[']|['"]$/g, "");
}

function getCloudinaryConfig(): CloudinaryConfig {
  const cloudinaryUrl = cleanEnvValue(process.env.CLOUDINARY_URL);

  if (cloudinaryUrl) {
    try {
      const parsed = new URL(cloudinaryUrl);
      const apiKey = decodeURIComponent(parsed.username || "");
      const apiSecret = decodeURIComponent(parsed.password || "");
      const cloudName = parsed.hostname;
      const missing = [
        ["CLOUDINARY_URL api_key", apiKey],
        ["CLOUDINARY_URL api_secret", apiSecret],
        ["CLOUDINARY_URL cloud_name", cloudName],
      ] satisfies Array<[string, string | undefined]>;

      return {
        cloudName,
        apiKey,
        apiSecret,
        missing: missing.filter(([, value]) => !value).map(([key]) => key),
      };
    } catch {
      return { missing: ["valid CLOUDINARY_URL"] };
    }
  }

  const cloudName = cleanEnvValue(process.env.CLOUDINARY_CLOUD_NAME);
  const apiKey = cleanEnvValue(process.env.CLOUDINARY_API_KEY);
  const apiSecret = cleanEnvValue(process.env.CLOUDINARY_API_SECRET);
  const missing = [
    ["CLOUDINARY_CLOUD_NAME", cloudName],
    ["CLOUDINARY_API_KEY", apiKey],
    ["CLOUDINARY_API_SECRET", apiSecret],
  ] satisfies Array<[string, string | undefined]>;

  return {
    cloudName,
    apiKey,
    apiSecret,
    missing: missing.filter(([, value]) => !value).map(([key]) => key),
  };
}

export async function POST(request: Request) {
  const { folder = "pinstory-music" } = (await request.json().catch(() => ({}))) as { folder?: string };
  const { cloudName, apiKey, apiSecret, missing } = getCloudinaryConfig();

  if (missing.length > 0 || !cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: `Cloudinary is not configured. Missing: ${missing.join(", ")}.` }, { status: 503 });
  }

  const timestamp = Math.round(Date.now() / 1000).toString();
  const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, apiSecret);

  return NextResponse.json({
    cloudName,
    apiKey,
    folder,
    timestamp,
    signature,
  });
}
