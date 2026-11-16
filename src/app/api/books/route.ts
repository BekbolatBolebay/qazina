import { NextRequest, NextResponse } from "next/server";
import { getAllBooks, maxAllowedAgeForGroup } from "@/lib/books";
import type { AgeGroup } from "@/types/user";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const lang = searchParams.get("lang") || "all";
  const readableOnly = searchParams.get("readable") === "1";
  const ageGroup = (searchParams.get("age_group") || "") as AgeGroup | "";

  const maxAge = ageGroup ? maxAllowedAgeForGroup(ageGroup) : 99;

  const list = getAllBooks()
    .filter((b) => {
      const hasContent = (b.chapters && b.chapters.length > 0) || Boolean(b.pdf_preview_url);
      if (readableOnly && !hasContent) return false;
      if (lang !== "all" && b.language !== lang) return false;
      if (b.age_min > maxAge) return false;
      if (q) {
        const hay = `${b.title} ${b.author} ${b.genre} ${b.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map(({ chapters, ...meta }) => ({
      ...meta,
      total_chapters: chapters.length,
    }));

  return NextResponse.json({ total: list.length, books: list });
}
