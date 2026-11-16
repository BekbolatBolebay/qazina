import { NextRequest, NextResponse } from "next/server";
import { trackAnalyticsEvent } from "@/lib/analyticsStore";
import { getQuestData } from "@/lib/books";

export async function GET() {
  return NextResponse.json(getQuestData());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action;
    if (action === "qr_scan") {
      return NextResponse.json(trackAnalyticsEvent("quest_qr_scan"));
    }
    if (action === "chapter_read") {
      return NextResponse.json(trackAnalyticsEvent("quest_chapter_read"));
    }
    if (action === "quest_complete") {
      return NextResponse.json(trackAnalyticsEvent("quest_complete"));
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
