import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const lang = String(form.get("language") || "kk");

    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Аудио файл табылмады." },
        { status: 400 },
      );
    }

    const useKk = lang === "kk";
    const apiKey = useKk
      ? process.env.ALEM_STT_KK_KEY || process.env.ALEM_STT_KEY || ""
      : process.env.ALEM_STT_KEY || process.env.ALEM_STT_KK_KEY || "";
    const model = useKk ? "speech-to-text-kk" : "speech-to-text";
    const url =
      process.env.ALEM_STT_URL ||
      "https://llm.alem.ai/v1/audio/transcriptions";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Speech-to-Text API кілті бапталмаған." },
        { status: 503 },
      );
    }

    const upstream = new FormData();
    upstream.append("model", model);
    upstream.append("file", file, "mood-voice.webm");
    if (!useKk) {
      upstream.append("language", lang === "ru" ? "ru" : "en");
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: upstream,
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Дыбысты тану сәтсіз аяқталды." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      text: data?.text || "",
      model,
    });
  } catch {
    return NextResponse.json(
      { error: "Дауысты өңдеу кезінде қате орын алды." },
      { status: 500 },
    );
  }
}
