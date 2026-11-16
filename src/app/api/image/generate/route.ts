import { NextRequest, NextResponse } from "next/server";
import { callAlemImageGen } from "@/lib/llm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = String(body?.text || "").trim().slice(0, 300);
    const title = String(body?.title || "").trim().slice(0, 100);

    if (!text) {
      return NextResponse.json(
        { error: "Сурет салу үшін мәтін қажет." },
        { status: 400 },
      );
    }

    const prompt = `Warm atmospheric literary book illustration, soft cinematic lighting, deep forest green and warm gold palette, calm artistic minimalism, inspired by story "${title}": ${text}`;
    const imageUrl = await callAlemImageGen(prompt);

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Иллюстрация жасау уақытша қолжетімсіз." },
        { status: 503 },
      );
    }

    return NextResponse.json({
      image_url: imageUrl,
      model: process.env.ALEM_IMAGE_MODEL || "text-to-image",
    });
  } catch {
    return NextResponse.json(
      { error: "Сурет жасау сәтсіз аяқталды." },
      { status: 500 },
    );
  }
}
