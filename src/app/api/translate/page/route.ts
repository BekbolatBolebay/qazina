import { NextRequest, NextResponse } from "next/server";
import { resolveLLMConfig } from "@/lib/llm";
import { TRIAL_FREE_PAGES, translatePageWithRAG } from "@/lib/translator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bookId = String(body.bookId || "").trim();
    const title = String(body.title || "Кітап").trim();
    const pageNumber = Number(body.pageNumber || 1);
    const text = String(body.text || "").trim();
    const prevText =
      typeof body.prevText === "string" ? body.prevText : undefined;
    const unlocked = Boolean(body.unlocked);

    if (!bookId || !text || !Number.isFinite(pageNumber) || pageNumber < 1) {
      return NextResponse.json(
        { error: "bookId, pageNumber және text міндетті." },
        { status: 400 }
      );
    }

    if (pageNumber > TRIAL_FREE_PAGES && !unlocked) {
      return NextResponse.json(
        {
          paywall: true,
          freePages: TRIAL_FREE_PAGES,
          pageNumber,
          error: `Алғашқы ${TRIAL_FREE_PAGES} бет тегін аударылады. Толық кітапты аудару үшін Pro тарифін ашыңыз.`,
        },
        { status: 402 }
      );
    }

    const llmConfig = resolveLLMConfig(req.headers);
    const result = await translatePageWithRAG({
      bookId,
      title,
      pageNumber,
      text,
      prevText,
      llmConfig,
    });

    return NextResponse.json({
      pageNumber,
      text: result.text,
      model: result.model,
      cached: result.cached,
      glossary: result.glossary,
    });
  } catch (error) {
    console.error("[translate/page] error:", error);
    return NextResponse.json(
      { error: "Бетті аудару кезінде қате шықты." },
      { status: 500 }
    );
  }
}
