import { NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const sha256 = formData.get("sha256") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!sha256) {
    return NextResponse.json(
      { error: "SHA-256 hash required" },
      { status: 400 }
    );
  }

  // Use SHA-256 prefix path for content-addressed storage
  const prefix = sha256.substring(0, 2);
  const key = `logic-blobs/${prefix}/${sha256}/${file.name}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadToR2(key, buffer, file.type || "application/octet-stream");

  return NextResponse.json({
    url,
    sha256,
    size: file.size,
  });
}
