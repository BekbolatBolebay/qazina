import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { resolveLLMConfig } from "@/lib/llm";
import {
  TRIAL_FREE_PAGES,
  extractAndSaveGlossary,
  splitRawTextIntoPages,
} from "@/lib/translator";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "PDF файл таңдалмады." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Файл бос." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Файл өлшемі 30 МБ-тан аспауы керек." },
        { status: 413 }
      );
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return NextResponse.json(
        { error: "Тек .pdf форматындағы кітаптарды жүктеуге болады." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = await pdfParse(buffer);
    const rawText = (parsed.text || "").trim();

    if (!rawText) {
      return NextResponse.json(
        {
          error:
            "PDF ішінен мәтін оқылмады (тек сканерленген сурет болуы мүмкін).",
        },
        { status: 422 }
      );
    }

    const pages = splitRawTextIntoPages(rawText, 1050);
    if (pages.length === 0) {
      return NextResponse.json(
        { error: "Беттерге бөлу мүмкін болмады." },
        { status: 422 }
      );
    }

    const title =
      file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() ||
      "Жүктелген кітап";

    const hash = crypto
      .createHash("sha256")
      .update(buffer.subarray(0, 65536))
      .update(`:${pages.length}:${title}`)
      .digest("hex")
      .slice(0, 16);
    const bookId = `pdf_${hash}`;

    const llmConfig = resolveLLMConfig(req.headers);
    const sampleText = pages.slice(0, 2).join("\n\n");
    const glossary = await extractAndSaveGlossary(
      bookId,
      title,
      sampleText,
      llmConfig
    );

    return NextResponse.json({
      bookId,
      title,
      totalPages: pages.length,
      pdfPages: parsed.numpages || pages.length,
      freePages: TRIAL_FREE_PAGES,
      pages,
      glossary,
    });
  } catch (error) {
    console.error("[translate/upload] error:", error);
    return NextResponse.json(
      { error: "PDF файлды өңдеу кезінде қате шықты." },
      { status: 500 }
    );
  }
}
