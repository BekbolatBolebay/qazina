import { NextRequest, NextResponse } from "next/server";
import {
  addServerMoment,
  getServerMoments,
  likeServerMoment,
} from "@/lib/analyticsStore";
import type { MomentPost } from "@/types/user";

export async function GET() {
  return NextResponse.json({ items: getServerMoments() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.action === "like" && body?.id) {
      return NextResponse.json({ items: likeServerMoment(String(body.id)) });
    }
    if (!body?.body?.trim()) {
      return NextResponse.json(
        { error: "Жазба мәтіні бос болмауы керек." },
        { status: 400 },
      );
    }
    const post: MomentPost = {
      id: `moment_${Date.now()}`,
      author_name: (body.author_name || "Оқырман").slice(0, 60),
      author_handle: body.author_handle || "@reader",
      kind: body.kind || "әсер",
      book_title: body.book_title || "QAZINA үзіндісі",
      book_slug: body.book_slug || "abay-qara-sozder",
      quote: body.quote ? String(body.quote).slice(0, 500) : undefined,
      body: String(body.body).trim().slice(0, 1000),
      likes: 1,
      comments: [],
      created_at: new Date().toISOString(),
    };
    const items = addServerMoment(post);
    return NextResponse.json({ item: post, items }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Қате сұраныс" }, { status: 400 });
  }
}
