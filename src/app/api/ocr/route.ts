import { NextRequest, NextResponse } from "next/server";
import { callAlemOCR } from "@/lib/llm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const imageDataUrl = String(body?.image_data_url || "").trim();

    if (!imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Жарамды сурет (image_data_url) жіберіңіз." },
        { status: 400 },
      );
    }

    const text = await callAlemOCR(imageDataUrl);
    if (!text) {
      return NextResponse.json(
        { error: "Суреттен мәтін оқылмады." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      text,
      model: "deepseek-ocr",
    });
  } catch {
    return NextResponse.json(
      { error: "OCR қызметінде қате орын алды." },
      { status: 500 },
    );
  }
}
