import { NextRequest, NextResponse } from "next/server";
import {
  getAnalyticsSummary,
  trackAnalyticsEvent,
  type AnalyticsEventType,
} from "@/lib/analyticsStore";

export async function GET() {
  return NextResponse.json(getAnalyticsSummary());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = body?.event as AnalyticsEventType;
    if (!event) {
      return NextResponse.json({ error: "Missing event" }, { status: 400 });
    }
    const summary = trackAnalyticsEvent(event);
    return NextResponse.json(summary);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
