import { NextRequest, NextResponse } from "next/server";
import { resolveLLMConfig } from "@/lib/llm";
import { askAboutPassage } from "@/lib/translator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bookTitle = String(body.bookTitle || "Кітап").trim();
    const pageText = String(body.pageText || "").trim();
    const selectedText =
      typeof body.selectedText === "string" ? body.selectedText.trim() : undefined;
    const question = String(body.question || "").trim();

    if (!pageText || !question) {
      return NextResponse.json(
        { error: "pageText және question міндетті." },
        { status: 400 }
      );
    }

    const llmConfig = resolveLLMConfig(req.headers);
    const result = await askAboutPassage({
      bookTitle,
      pageText,
      selectedText,
      question,
      llmConfig,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[translate/ask] error:", error);
    return NextResponse.json(
      { error: "Сұраққа жауап беру кезінде қате шықты." },
      { status: 500 }
    );
  }
}
