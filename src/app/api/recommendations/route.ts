import { NextRequest, NextResponse } from "next/server";
import { trackAnalyticsEvent } from "@/lib/analyticsStore";
import { resolveLLMConfig } from "@/lib/llm";
import { recommendFragment } from "@/lib/recommender";
import type { RecommendationRequest } from "@/types/recommendation";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RecommendationRequest;
    const moodText = (body?.mood_text || "").trim();

    if (!moodText && !body?.selected_mood && !body?.analysis) {
      return NextResponse.json(
        { error: "Бос сұраныс: көңіл күйді енгізіңіз немесе таңдаңыз." },
        { status: 400 },
      );
    }

    const llmConfig = resolveLLMConfig(req.headers);
    const result = await recommendFragment(body, llmConfig);

    if (body?.exclude_ids && body.exclude_ids.length > 0) {
      trackAnalyticsEvent("skip");
    } else {
      trackAnalyticsEvent("mood_submission");
    }

    if (result.fragment) {
      trackAnalyticsEvent("fragment_view");
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Ұсыныс жасау кезінде қате орын алды." },
      { status: 500 },
    );
  }
}
