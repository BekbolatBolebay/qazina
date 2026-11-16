import { NextRequest, NextResponse } from "next/server";
import { getServerProfile, updateServerProfile } from "@/lib/analyticsStore";

export async function GET() {
  return NextResponse.json(getServerProfile());
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = updateServerProfile(body || {});
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Профильді жаңарту сәтсіз аяқталды." },
      { status: 400 },
    );
  }
}
