import { Pool } from "pg";
import { callCloudLLM, extractJSONObject, type LLMConfig } from "./llm";

export const TRIAL_FREE_PAGES = 2;

let pool: Pool | null = null;
let tablesReady = false;

function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 4,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 3000,
    });
  }
  return pool;
}

const memTranslations = new Map<string, string>();
const memGlossaries = new Map<string, string>();

async function ensureTables(p: Pool): Promise<void> {
  if (tablesReady) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS qazina_translations (
      book_id TEXT NOT NULL,
      page_number INT NOT NULL,
      target_lang TEXT NOT NULL DEFAULT 'kk',
      original_text TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'alemllm',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (book_id, page_number, target_lang)
    );
    CREATE TABLE IF NOT EXISTS qazina_glossaries (
      book_id TEXT PRIMARY KEY,
      glossary TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  tablesReady = true;
}

export function splitRawTextIntoPages(rawText: string, charsPerPage = 1050): string[] {
  const cleaned = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\f+/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const paragraphs = cleaned
    .split(/\n\n+/)
    .map((p) => p.replace(/[ \t]{2,}/g, " ").trim())
    .filter((p) => p.length > 10);

  const pages: string[] = [];
  let buf: string[] = [];
  let bufLen = 0;

  for (const para of paragraphs) {
    if (bufLen > 0 && bufLen + para.length > charsPerPage) {
      pages.push(buf.join("\n\n"));
      buf = [];
      bufLen = 0;
    }
    buf.push(para);
    bufLen += para.length;
    if (bufLen >= charsPerPage) {
      pages.push(buf.join("\n\n"));
      buf = [];
      bufLen = 0;
    }
  }
  if (buf.length > 0) {
    pages.push(buf.join("\n\n"));
  }
  return pages;
}

export async function getGlossary(bookId: string): Promise<string> {
  if (memGlossaries.has(bookId)) return memGlossaries.get(bookId) || "";
  const p = getPool();
  if (!p) return "";
  try {
    await ensureTables(p);
    const res = await p.query(
      "SELECT glossary FROM qazina_glossaries WHERE book_id = $1",
      [bookId],
    );
    const g = res.rows[0]?.glossary || "";
    if (g) memGlossaries.set(bookId, g);
    return g;
  } catch {
    return "";
  }
}

export async function extractAndSaveGlossary(
  bookId: string,
  title: string,
  sampleText: string,
  llmConfig: LLMConfig,
): Promise<string> {
  const existing = await getGlossary(bookId);
  if (existing) return existing;

  let glossary = "";
  const res = await callCloudLLM(
    [
      {
        role: "system",
        content:
          "You are a literary translator preparing a Kazakh translation glossary. Extract up to 10 key character names, places, and recurring terms from the excerpt with their exact standard Kazakh transliteration/translation, plus 1 line about the literary tone. Reply concisely in plain bullet text.",
      },
      {
        role: "user",
        content: `Book: ${title}\n\nExcerpt:\n${sampleText.slice(0, 1800)}`,
      },
    ],
    llmConfig,
    8000,
  );

  if (res?.content) {
    glossary = res.content.slice(0, 1200);
  } else {
    glossary = `Кітап: ${title}. Көркем әдеби стиль, кейіпкер аттары мен терминдерін барлық бетте бірізді сақта.`;
  }

  memGlossaries.set(bookId, glossary);
  const p = getPool();
  if (p) {
    try {
      await ensureTables(p);
      await p.query(
        `INSERT INTO qazina_glossaries (book_id, glossary) VALUES ($1, $2)
         ON CONFLICT (book_id) DO UPDATE SET glossary = EXCLUDED.glossary, updated_at = now()`,
        [bookId, glossary],
      );
    } catch {
      // ignore db cache error
    }
  }
  return glossary;
}

export async function getCachedTranslation(
  bookId: string,
  pageNumber: number,
): Promise<{ text: string; model: string; cached: boolean } | null> {
  const key = `${bookId}:${pageNumber}`;
  if (memTranslations.has(key)) {
    return { text: memTranslations.get(key)!, model: "cache", cached: true };
  }
  const p = getPool();
  if (!p) return null;
  try {
    await ensureTables(p);
    const res = await p.query(
      `SELECT translated_text, model FROM qazina_translations
       WHERE book_id = $1 AND page_number = $2 AND target_lang = 'kk'`,
      [bookId, pageNumber],
    );
    if (res.rows[0]?.translated_text) {
      memTranslations.set(key, res.rows[0].translated_text);
      return {
        text: res.rows[0].translated_text,
        model: res.rows[0].model || "supabase-cache",
        cached: true,
      };
    }
  } catch {
    // ignore db read error
  }
  return null;
}

export async function translatePageWithRAG(params: {
  bookId: string;
  title: string;
  pageNumber: number;
  text: string;
  prevText?: string;
  llmConfig: LLMConfig;
}): Promise<{ text: string; model: string; cached: boolean; glossary: string }> {
  const cached = await getCachedTranslation(params.bookId, params.pageNumber);
  const glossary = await getGlossary(params.bookId);
  if (cached) {
    return { ...cached, glossary };
  }

  const activeGlossary =
    glossary ||
    (await extractAndSaveGlossary(
      params.bookId,
      params.title,
      params.text,
      params.llmConfig,
    ));

  // Prioritize KazLLM / AlemLLM / Qwen3-8 for faithful Kazakh literary translation
  const kazConfig: LLMConfig = {
    ...params.llmConfig,
    model: process.env.ALEM_KAZLLM_KEY ? "kazllm" : params.llmConfig.model,
    apiKey: process.env.ALEM_KAZLLM_KEY || params.llmConfig.apiKey,
  };

  const systemPrompt = `Сен кәсіби әдеби аудармашысың (QAZINA AI Literary Translator).
Міндетің: берілген кітап бетін түпнұсқа мағынасынан ауытқымай, ойдан ештеңе қоспай, табиғи, көркем әрі түсінікті ҚАЗАҚ тіліне аудару.
Ережелер:
1. Төмендегі кітап глоссарийі мен кейіпкер есімдерін дәл сақта.
2. Диалогтарды жанды қазақ тілінде, абзац құрылымын сақтап аудар.
3. Тек аударма мәтінін ғана қайтар (кіріспе немесе түсіндірме қоспа).

Кітап глоссарийі (RAG контекст):
${activeGlossary}`;

  const userPrompt = params.prevText
    ? `Алдыңғы беттің соңы (контекст үшін, мұны қайта аударма):\n"${params.prevText.slice(-300)}"\n\nАударылатын ${params.pageNumber}-бет:\n${params.text}`
    : `Аударылатын ${params.pageNumber}-бет:\n${params.text}`;

  const llmRes = await callCloudLLM(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    kazConfig,
    18000,
  );

  const translatedText =
    llmRes?.content?.trim() ||
    `[Offline режим — Cloud AI кілті қажет]\n\n${params.text}`;
  const usedModel = llmRes?.model || "offline";

  if (llmRes?.content) {
    memTranslations.set(`${params.bookId}:${params.pageNumber}`, translatedText);
    const p = getPool();
    if (p) {
      try {
        await ensureTables(p);
        await p.query(
          `INSERT INTO qazina_translations (book_id, page_number, target_lang, original_text, translated_text, model)
           VALUES ($1, $2, 'kk', $3, $4, $5)
           ON CONFLICT (book_id, page_number, target_lang) DO UPDATE
           SET translated_text = EXCLUDED.translated_text, model = EXCLUDED.model`,
          [params.bookId, params.pageNumber, params.text, translatedText, usedModel],
        );
      } catch {
        // ignore db cache write error
      }
    }
  }

  return {
    text: translatedText,
    model: usedModel,
    cached: false,
    glossary: activeGlossary,
  };
}

export async function translatePagesParallel(params: {
  bookId: string;
  title: string;
  pages: { pageNumber: number; text: string; prevText?: string }[];
  llmConfig: LLMConfig;
  concurrency?: number;
}): Promise<{ pageNumber: number; text: string; model: string; cached: boolean }[]> {
  const workers = Math.min(8, Math.max(1, params.concurrency || 8));
  const results: { pageNumber: number; text: string; model: string; cached: boolean }[] = [];
  let cursor = 0;

  async function runWorker() {
    while (cursor < params.pages.length) {
      const idx = cursor++;
      const item = params.pages[idx];
      const res = await translatePageWithRAG({
        bookId: params.bookId,
        title: params.title,
        pageNumber: item.pageNumber,
        text: item.text,
        prevText: item.prevText,
        llmConfig: params.llmConfig,
      });
      results.push({
        pageNumber: item.pageNumber,
        text: res.text,
        model: res.model,
        cached: res.cached,
      });
    }
  }

  await Promise.all(Array.from({ length: workers }, () => runWorker()));
  return results.sort((a, b) => a.pageNumber - b.pageNumber);
}

export async function askAboutPassage(params: {
  bookTitle: string;
  pageText: string;
  selectedText?: string;
  question: string;
  llmConfig: LLMConfig;
}): Promise<{ answer: string; model: string }> {
  const res = await callCloudLLM(
    [
      {
        role: "system",
        content:
          "Сен QAZINA AI әдеби кеңесшісісің. Оқырманның кітап бетінен түсінбеген сөзін, идиомасын немесе астарын осы беттің контекстіне сүйеніп, қарапайым әрі дәл ҚАЗАҚ тілінде 2–4 сөйлеммен түсіндіріп бер. Ешнәрсе ойдан қоспа.",
      },
      {
        role: "user",
        content: `Кітап: ${params.bookTitle}\n\nБет мәтіні:\n${params.pageText.slice(0, 1500)}\n\n${
          params.selectedText ? `Белгіленген үзінді: "${params.selectedText}"\n` : ""
        }Оқырман сұрағы: ${params.question}`,
      },
    ],
    params.llmConfig,
    12000,
  );

  if (res?.content) {
    // Also clean any accidental JSON wrapper
    const maybeJson = extractJSONObject(res.content);
    if (maybeJson && res.content.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(maybeJson);
        if (parsed.answer) return { answer: String(parsed.answer), model: res.model };
      } catch {
        // use raw
      }
    }
    return { answer: res.content, model: res.model };
  }

  return {
    answer: "Қазір бұлттық ИИ жауап бере алмады. Бірнеше секундтан кейін қайталап көріңіз.",
    model: "offline",
  };
}
