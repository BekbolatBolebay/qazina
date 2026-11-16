import { NextRequest, NextResponse } from "next/server";
import { probeCloudLLM, resolveLLMConfig } from "@/lib/llm";

export async function GET(req: NextRequest) {
  const config = resolveLLMConfig(req.headers);
  const status = await probeCloudLLM(config);
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const base = resolveLLMConfig(req.headers);
    const config = {
      url: typeof body?.apiUrl === "string" && body.apiUrl.trim() ? body.apiUrl.trim() : base.url,
      apiKey: typeof body?.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : base.apiKey,
      model: typeof body?.model === "string" && body.model.trim() ? body.model.trim() : base.model,
      provider: base.provider,
    };
    const status = await probeCloudLLM(config);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ configured: false, reachable: false }, { status: 400 });
  }
}
