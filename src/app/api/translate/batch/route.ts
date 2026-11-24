import { NextRequest, NextResponse } from "next/server";
import { resolveLLMConfig } from "@/lib/llm";
import { TRIAL_FREE_PAGES, translatePagesParallel } from "@/lib/translator";

export const runtime = "nodejs";
export const maxDuration = 60;

interface BatchPageInput {
  pageNumber: number;
  text: string;
  prevText?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bookId = String(body.bookId || "").trim();
    const title = String(body.title || "Кітап").trim();
    const unlocked = Boolean(body.unlocked);
    const rawPages = Array.isArray(body.pages) ? body.pages : [];

    if (!unlocked) {
      return NextResponse.json(
        {
          paywall: true,
          freePages: TRIAL_FREE_PAGES,
          error:
            "8 ағынды толық кітап аудармасы тек Pro тарифі ашылғаннан кейін іске қосылады.",
        },
        { status: 402 }
      );
    }

    if (!bookId || rawPages.length === 0) {
      return NextResponse.json(
        { error: "bookId және pages массиві міндетті." },
        { status: 400 }
      );
    }

    const pages: BatchPageInput[] = rawPages
      .slice(0, 8)
      .map((p: Record<string, unknown>) => ({
        pageNumber: Number(p.pageNumber || 1),
        text: String(p.text || "").trim(),
        prevText: typeof p.prevText === "string" ? p.prevText : undefined,
      }))
      .filter((p: BatchPageInput) => p.pageNumber >= 1 && p.text.length > 0);

    if (pages.length === 0) {
      return NextResponse.json(
        { error: "Жарамды беттер табылмады." },
        { status: 400 }
      );
    }

    const llmConfig = resolveLLMConfig(req.headers);
    const results = await translatePagesParallel({
      bookId,
      title,
      pages,
      llmConfig,
      concurrency: 8,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[translate/batch] error:", error);
    return NextResponse.json(
      { error: "8 ағынды аударма кезінде қате шықты." },
      { status: 500 }
    );
  }
}
