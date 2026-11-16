import { NextRequest, NextResponse } from "next/server";
import { getBookBySlug } from "@/lib/books";
import { getAllFragments } from "@/lib/fragments";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const book = getBookBySlug(slug);
  if (!book) {
    return NextResponse.json({ error: "Кітап табылмады" }, { status: 404 });
  }
  const fragments = getAllFragments().filter((f) => f.book_id === book.id);
  return NextResponse.json({ book, fragments });
}
