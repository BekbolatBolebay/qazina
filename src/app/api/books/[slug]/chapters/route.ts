import { NextRequest, NextResponse } from "next/server";
import { getBookBySlug, getChaptersBySlug } from "@/lib/books";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const book = getBookBySlug(slug);
  if (!book) {
    return NextResponse.json({ error: "Кітап табылмады" }, { status: 404 });
  }
  return NextResponse.json({
    book_id: book.id,
    slug: book.slug,
    title: book.title,
    author: book.author,
    chapters: getChaptersBySlug(slug),
  });
}
