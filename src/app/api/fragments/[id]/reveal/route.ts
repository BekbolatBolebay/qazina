import { NextRequest, NextResponse } from "next/server";
import { trackAnalyticsEvent } from "@/lib/analyticsStore";
import { buildRevealPayload, getFragmentById } from "@/lib/fragments";
import { callCloudLLM, resolveLLMConfig } from "@/lib/llm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fragment = getFragmentById(id);
  if (!fragment) {
    return NextResponse.json({ error: "Үзінді табылмады" }, { status: 404 });
  }

  let moodText = "";
  try {
    const body = await req.json();
    moodText = typeof body?.mood_text === "string" ? body.mood_text.trim() : "";
  } catch {
    // empty body allowed
  }

  let customExplanation: string | undefined;
  const llmConfig = resolveLLMConfig(req.headers);

  if (llmConfig.apiKey && moodText) {
    const llmRes = await callCloudLLM(
      [
        {
          role: "system",
          content:
            "Сен QAZINA әдеби платформасының кураторысың. Оқырманның көңіл күйі мен кейіпкер жағдайы арасындағы байланысты 1-2 қысқа қазақша сөйлеммен түсіндір. Медициналық диагноз қойма.",
        },
        {
          role: "user",
          content: `Оқырман күйі: "${moodText}"\nКейіпкер: ${fragment.character_name}\nКейіпкер жағдайы: ${fragment.character_situation}`,
        },
      ],
      llmConfig,
      6000,
    );
    if (llmRes?.content) {
      customExplanation = llmRes.content;
    }
  }

  const reveal = buildRevealPayload(fragment, customExplanation);
  if (!reveal) {
    return NextResponse.json({ error: "Кітап табылмады" }, { status: 404 });
  }

  trackAnalyticsEvent("reveal");
  return NextResponse.json(reveal);
}
