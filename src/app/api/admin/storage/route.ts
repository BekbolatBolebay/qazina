import { NextResponse } from "next/server";
import { getSupabaseStorageStatus } from "@/lib/supabaseDb";

export async function GET() {
  const status = await getSupabaseStorageStatus();
  return NextResponse.json(status);
}
