export interface LLMConfig {
  url: string;
  apiKey: string;
  model: string;
  provider: string;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function resolveLLMConfig(headers?: Headers): LLMConfig {
  const headerKey = headers?.get("x-llm-api-key")?.trim() || "";
  const headerUrl = headers?.get("x-llm-api-url")?.trim() || "";
  const headerModel = headers?.get("x-llm-model")?.trim() || "";

  const url =
    headerUrl ||
    process.env.LLM_API_URL ||
    "https://llm.alem.ai/v1/chat/completions";
  const model = headerModel || process.env.LLM_MODEL || "qwen3-8";

  let apiKey = headerKey || process.env.LLM_API_KEY || "";
  if (!headerKey) {
    if (model === "kazllm" && process.env.ALEM_KAZLLM_KEY) {
      apiKey = process.env.ALEM_KAZLLM_KEY;
    } else if (model === "gemma4" && process.env.ALEM_GEMMA4_KEY) {
      apiKey = process.env.ALEM_GEMMA4_KEY;
    } else if (model === "qwen3-8" && process.env.ALEM_QWEN_KEY) {
      apiKey = process.env.ALEM_QWEN_KEY;
    }
  }

  let provider = process.env.LLM_PROVIDER || "alem";
  if (url.includes("ollama.com") || url.includes(":11434")) {
    provider = "ollama-cloud";
  } else if (url.includes("llm.alem.ai")) {
    provider = "alem";
  } else if (url.includes("openai.com")) {
    provider = "openai";
  } else if (url.includes("groq.com")) {
    provider = "groq";
  }

  return { url, apiKey, model, provider };
}

export function extractJSONObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

async function singleChatCall(
  messages: LLMMessage[],
  url: string,
  apiKey: string,
  model: string,
  timeoutMs: number,
): Promise<{ content: string; model: string } | null> {
  if (!apiKey || !url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const isOllamaNative = url.endsWith("/api/chat") && !url.includes("/v1/");
    const body = isOllamaNative
      ? { model, messages, stream: false, options: { temperature: 0.2 } }
      : { model, messages, stream: false, temperature: 0.2, max_tokens: 450 };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();

    const openAiContent = data?.choices?.[0]?.message?.content;
    if (typeof openAiContent === "string" && openAiContent.trim()) {
      return { content: openAiContent.trim(), model };
    }

    const ollamaContent = data?.message?.content;
    if (typeof ollamaContent === "string" && ollamaContent.trim()) {
      return { content: ollamaContent.trim(), model };
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function callCloudLLM(
  messages: LLMMessage[],
  config: LLMConfig,
  timeoutMs = 10000,
): Promise<{ content: string; model: string } | null> {
  const attempts: { url: string; apiKey: string; model: string }[] = [
    { url: config.url, apiKey: config.apiKey, model: config.model },
  ];

  // Add Alem Plus resilient model fallbacks when running on llm.alem.ai
  if (config.url.includes("llm.alem.ai")) {
    if (process.env.ALEM_KAZLLM_KEY && config.model !== "kazllm") {
      attempts.push({
        url: config.url,
        apiKey: process.env.ALEM_KAZLLM_KEY,
        model: "kazllm",
      });
    }
    if (process.env.ALEM_GEMMA4_KEY && config.model !== "gemma4") {
      attempts.push({
        url: config.url,
        apiKey: process.env.ALEM_GEMMA4_KEY,
        model: "gemma4",
      });
    }
  }

  for (const att of attempts) {
    if (!att.apiKey) continue;
    const res = await singleChatCall(
      messages,
      att.url,
      att.apiKey,
      att.model,
      timeoutMs,
    );
    if (res) return res;
  }

  return null;
}

export async function callAlemReranker(
  query: string,
  documents: string[],
  topN = 6,
): Promise<Map<number, number> | null> {
  const apiKey = process.env.ALEM_RERANK_KEY || "";
  const url = process.env.ALEM_RERANK_URL || "https://llm.alem.ai/v1/rerank";
  const model = process.env.ALEM_RERANK_MODEL || "reranker";
  if (!apiKey || documents.length === 0) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, query, documents, top_n: topN }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const map = new Map<number, number>();
    if (Array.isArray(data?.results)) {
      for (const item of data.results) {
        if (
          typeof item?.index === "number" &&
          typeof item?.relevance_score === "number"
        ) {
          map.set(item.index, item.relevance_score);
        }
      }
    }
    return map.size > 0 ? map : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function callAlemEmbeddings(
  inputs: string[],
): Promise<number[][] | null> {
  const apiKey = process.env.ALEM_EMBED_KEY || "";
  const url = process.env.ALEM_EMBED_URL || "https://llm.alem.ai/v1/embeddings";
  const model = process.env.ALEM_EMBED_MODEL || "text-1024";
  if (!apiKey || inputs.length === 0) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: inputs }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.data)) return null;
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function callAlemImageGen(prompt: string): Promise<string | null> {
  const apiKey = process.env.ALEM_IMAGE_KEY || "";
  const url =
    process.env.ALEM_IMAGE_URL || "https://llm.alem.ai/v1/images/generations";
  const model = process.env.ALEM_IMAGE_MODEL || "text-to-image";
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, prompt, size: "512x512" }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (typeof b64 === "string" && b64.length > 20) {
      return `data:image/png;base64,${b64}`;
    }
    const imageUrl = data?.data?.[0]?.url;
    return typeof imageUrl === "string" ? imageUrl : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function callAlemOCR(
  imageDataUrl: string,
  prompt = "Extract all literary text or quotes from this book page cleanly in the original language. Reply only with the extracted text.",
): Promise<string | null> {
  const apiKey = process.env.ALEM_OCR_KEY || "";
  const url =
    process.env.LLM_API_URL || "https://llm.alem.ai/v1/chat/completions";
  if (!apiKey || !imageDataUrl) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-ocr",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        max_tokens: 600,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function listActiveAlemServices(): string[] {
  const services: string[] = [];
  if (process.env.ALEM_QWEN_KEY || process.env.LLM_API_KEY) services.push("qwen3-8");
  if (process.env.ALEM_KAZLLM_KEY) services.push("kazllm");
  if (process.env.ALEM_GEMMA4_KEY) services.push("gemma4");
  if (process.env.ALEM_RERANK_KEY) services.push("reranker");
  if (process.env.ALEM_EMBED_KEY) services.push("text-1024");
  if (process.env.ALEM_STT_KK_KEY) services.push("speech-to-text-kk");
  if (process.env.ALEM_STT_KEY) services.push("speech-to-text");
  if (process.env.ALEM_OCR_KEY) services.push("deepseek-ocr");
  if (process.env.ALEM_IMAGE_KEY) services.push("text-to-image");
  return services;
}

export async function probeCloudLLM(config: LLMConfig): Promise<{
  configured: boolean;
  reachable: boolean;
  provider: string;
  model: string;
  url: string;
  services: string[];
}> {
  const services = listActiveAlemServices();
  if (!config.apiKey) {
    return {
      configured: false,
      reachable: false,
      provider: config.provider,
      model: config.model,
      url: config.url,
      services,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const base = config.url
      .replace(/\/chat\/completions$/, "")
      .replace(/\/api\/chat$/, "");
    const modelsEndpoint = config.url.includes("ollama.com")
      ? `${base}/api/tags`
      : `${base}/models`;

    const res = await fetch(modelsEndpoint, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: controller.signal,
    });
    return {
      configured: true,
      reachable: res.ok,
      provider: config.provider,
      model: config.model,
      url: config.url,
      services,
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      provider: config.provider,
      model: config.model,
      url: config.url,
      services,
    };
  } finally {
    clearTimeout(timer);
  }
}
