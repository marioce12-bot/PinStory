import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";
export const maxDuration = 60;

type CloudinaryUpload = {
  secure_url: string;
  resource_type: string;
};

type CloudinaryUploadConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

type CloudinaryError = Error & {
  http_code?: number;
  error?: {
    message?: string;
  };
  code?: string | number;
};

type CloudinaryConfig = {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
  missing: string[];
  source: "CLOUDINARY_URL" | "separate_variables" | "invalid_cloudinary_url";
};

function cleanEnvValue(value?: string) {
  return value?.trim().replace(/^['"]|['"]$/g, "");
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
      const missingKeys = missing
        .filter(([, value]) => !value)
        .map(([key]) => key);

      return { cloudName, apiKey, apiSecret, missing: missingKeys, source: "CLOUDINARY_URL" };
    } catch {
      return {
        cloudName: undefined,
        apiKey: undefined,
        apiSecret: undefined,
        missing: ["valid CLOUDINARY_URL"],
        source: "invalid_cloudinary_url",
      };
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
  const missingKeys = missing
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return { cloudName, apiKey, apiSecret, missing: missingKeys, source: "separate_variables" };
}

function getCloudinaryDiagnostics() {
  const config = getCloudinaryConfig();
  const rawCloudinaryUrl = cleanEnvValue(process.env.CLOUDINARY_URL);

  return {
    ok: config.missing.length === 0,
    source: config.source,
    missing: config.missing,
    cloudName: config.cloudName || null,
    apiKeyPresent: Boolean(config.apiKey),
    apiKeyLast4: config.apiKey ? config.apiKey.slice(-4) : null,
    apiSecretPresent: Boolean(config.apiSecret),
    cloudinaryUrlPresent: Boolean(rawCloudinaryUrl),
    cloudinaryUrlStartsCorrectly: rawCloudinaryUrl ? rawCloudinaryUrl.startsWith("cloudinary://") : false,
    message:
      config.missing.length === 0
        ? "Cloudinary configuration is visible to Vercel. If upload still fails with 401, the API key/secret/cloud name combination is invalid."
        : `Cloudinary configuration is incomplete in Vercel. Missing: ${config.missing.join(", ")}.`,
  };
}

function getOptimizedCloudinaryUrl(url: string, resourceType: string) {
  if (!url.includes("/upload/")) return url;

  const transformation = resourceType === "video" ? "q_auto:good" : "f_auto,q_auto:good,w_1600,c_limit";
  return url.replace("/upload/", `/upload/${transformation}/`);
}

function getErrorMessage(error: unknown) {
  const cloudinaryError = error as CloudinaryError | undefined;
  const cloudinaryStatus = cloudinaryError?.http_code;
  if (cloudinaryStatus === 401) {
    return "Cloudinary rejected the credentials. Check CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in Vercel.";
  }

  if (cloudinaryError?.error?.message) return cloudinaryError.error.message;
  if (cloudinaryError?.message) return cloudinaryError.message;

  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown upload error";
  }
}

function getCloudinaryStatus(error: unknown) {
  const status = (error as CloudinaryError | undefined)?.http_code;
  if (typeof status === "number" && status >= 400 && status < 600) return status;
  return 502;
}

async function uploadToCloudinaryRest({
  bytes,
  resourceType,
  mimeType,
  fileName,
  config,
}: {
  bytes: Buffer;
  resourceType: "image" | "video";
  mimeType: string;
  fileName: string;
  config: CloudinaryUploadConfig;
}) {
  const timestamp = Math.round(Date.now() / 1000).toString();
  const signature = cloudinary.utils.api_sign_request({ timestamp }, config.apiSecret);
  const formData = new FormData();

  formData.append("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), fileName);
  formData.append("api_key", config.apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: formData,
  });
  const responseText = await response.text();

  let payload: { secure_url?: string; resource_type?: string; error?: { message?: string } } = {};
  try {
    payload = JSON.parse(responseText) as typeof payload;
  } catch {
    // Keep raw text below for diagnostics.
  }

  if (!response.ok) {
    throw new Error(
      `Cloudinary upload failed (${response.status}): ${payload.error?.message || responseText || response.statusText}`,
    );
  }

  if (!payload.secure_url || !payload.resource_type) {
    throw new Error(`Cloudinary returned an incomplete upload response: ${responseText}`);
  }

  return { secure_url: payload.secure_url, resource_type: payload.resource_type } satisfies CloudinaryUpload;
}

export async function GET() {
  const diagnostics = getCloudinaryDiagnostics();
  const { cloudName, apiKey, apiSecret, missing } = getCloudinaryConfig();

  if (missing.length > 0) {
    return NextResponse.json({
      ...diagnostics,
      authPing: {
        ok: false,
        skipped: true,
        reason: "Cloudinary configuration is incomplete.",
      },
    });
  }

  try {
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    const ping = await cloudinary.api.ping();

    return NextResponse.json({
      ...diagnostics,
      authPing: {
        ok: true,
        status: ping?.status || "ok",
      },
    });
  } catch (error) {
    return NextResponse.json({
      ...diagnostics,
      authPing: {
        ok: false,
        status: getCloudinaryStatus(error),
        error: getErrorMessage(error),
      },
    });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const plan = String(formData.get("plan") || "free");

    if (!(file instanceof File)) return NextResponse.json({ error: "Missing file." }, { status: 400 });
    if (file.type.startsWith("video/") && plan !== "eternal") {
      return NextResponse.json({ error: "Videos require the Eternal plan." }, { status: 403 });
    }

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      return NextResponse.json({ error: "Only images and videos are supported." }, { status: 400 });
    }

    if (file.size > 12_000_000) {
      return NextResponse.json({ error: "File is too large after compression. Please choose a smaller file." }, { status: 413 });
    }

    const { cloudName, apiKey, apiSecret, missing } = getCloudinaryConfig();

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Cloudinary is not configured. Missing: ${missing.join(", ")}.`,
          diagnostics: getCloudinaryDiagnostics(),
        },
        { status: 503 },
      );
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    const resourceType = file.type.startsWith("video/") ? "video" : "image";
    const bytes = Buffer.from(await file.arrayBuffer());
    const upload = await uploadToCloudinaryRest({
      bytes,
      resourceType,
      mimeType: file.type || (resourceType === "image" ? "image/webp" : "video/mp4"),
      fileName: file.name || `pinstory-upload.${resourceType === "image" ? "webp" : "mp4"}`,
      config: { cloudName: cloudName!, apiKey: apiKey!, apiSecret: apiSecret! },
    });

    return NextResponse.json({
      media_url: getOptimizedCloudinaryUrl(upload.secure_url, upload.resource_type),
      media_type: upload.resource_type === "video" ? "video" : "image",
    });
  } catch (error) {
    console.error("PinStory upload failed", error);
    const status = getCloudinaryStatus(error);
    return NextResponse.json(
      {
        error: `Upload failed: ${getErrorMessage(error)}`,
        status,
        diagnostics: getCloudinaryDiagnostics(),
      },
      { status },
    );
  }
}
