import { NextRequest, NextResponse } from "next/server";
import { deleteServerSavedItem } from "@/lib/analyticsStore";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const items = deleteServerSavedItem(id);
  return NextResponse.json({ deleted: id, items });
}
