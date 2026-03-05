import { NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const key = `audio/${timestamp}-${random}/${file.name}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadToR2(key, buffer, file.type || "audio/mpeg");

  return NextResponse.json({ url });
}
