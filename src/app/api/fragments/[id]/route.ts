import { NextRequest, NextResponse } from "next/server";
import { getFragmentById } from "@/lib/fragments";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const f = getFragmentById(id);
  if (!f) {
    return NextResponse.json({ error: "Үзінді табылмады" }, { status: 404 });
  }

  // Strictly keep book title/author hidden until explicit reveal (Section 5 & 21)
  return NextResponse.json({
    fragment_id: f.id,
    text: f.text,
    type: f.type,
    language: f.language,
    dialogue_category: f.dialogue_category,
    moods: f.moods,
    topics: f.topics,
    revealed: false,
    dilemma: f.dilemma,
    actions: ["like", "save", "share", "reveal", "skip"],
  });
}
