import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";
export const maxDuration = 60;

function getOptimizedCloudinaryUrl(url: string, resourceType: string) {
  if (!url.includes("/upload/")) return url;

  const transformation = resourceType === "video" ? "q_auto:good" : "f_auto,q_auto:good,w_1600,c_limit";
  return url.replace("/upload/", `/upload/${transformation}/`);
}

export async function POST(request: Request) {
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

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Cloudinary is not configured yet." }, { status: 503 });
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  const bytes = Buffer.from(await file.arrayBuffer());

  const upload = await new Promise<{ secure_url: string; resource_type: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: "pinstory", resource_type: "auto", quality: "auto:good" }, (error, result) => {
        if (error || !result) reject(error || new Error("Upload failed."));
        else resolve({ secure_url: result.secure_url, resource_type: result.resource_type });
      })
      .end(bytes);
  });

  return NextResponse.json({
    media_url: getOptimizedCloudinaryUrl(upload.secure_url, upload.resource_type),
    media_type: upload.resource_type === "video" ? "video" : "image",
  });
}
