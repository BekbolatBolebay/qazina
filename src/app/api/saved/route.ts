import { NextRequest, NextResponse } from "next/server";
import { addServerSavedItem, getServerSavedItems } from "@/lib/analyticsStore";
import type { SavedFragmentItem } from "@/types/user";

export async function GET() {
  return NextResponse.json({ items: getServerSavedItems() });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SavedFragmentItem;
    if (!body?.fragment_id || !body?.text) {
      return NextResponse.json(
        { error: "Үзінді деректері толық емес." },
        { status: 400 },
      );
    }
    const item: SavedFragmentItem = {
      id: body.id || `saved_${Date.now()}`,
      fragment_id: body.fragment_id,
      text: body.text,
      revealed: Boolean(body.revealed),
      book_slug: body.book_slug,
      book_title: body.book_title,
      author: body.author,
      chapter_id: body.chapter_id,
      category: body.category || "Жүрегіме жақын",
      color: body.color || "green",
      note: (body.note || "").slice(0, 600),
      saved_at: body.saved_at || new Date().toISOString(),
    };
    const items = addServerSavedItem(item);
    return NextResponse.json({ item, items }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Сақтау сәтсіз аяқталды." },
      { status: 400 },
    );
  }
}
