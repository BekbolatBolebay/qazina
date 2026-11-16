import { NextRequest, NextResponse } from "next/server";
import { resolveLLMConfig } from "@/lib/llm";
import { analyzeMoodInput } from "@/lib/mood";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const moodText = typeof body?.mood_text === "string" ? body.mood_text : "";
    const selectedMood = body?.selected_mood;
    const intent = body?.intent;

    if (!moodText.trim() && !selectedMood) {
      return NextResponse.json(
        { error: "Ойыңды жаз немесе көңіл күйді таңда." },
        { status: 400 },
      );
    }

    const llmConfig = resolveLLMConfig(req.headers);
    const analysis = await analyzeMoodInput({
      mood_text: moodText,
      selected_mood: selectedMood,
      intent,
      llmConfig,
    });

    return NextResponse.json(analysis);
  } catch {
    return NextResponse.json(
      { error: "Көңіл күйді талдау сәтсіз аяқталды." },
      { status: 400 },
    );
  }
}
