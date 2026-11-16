import type { LanguageCode } from "@/types/book";
import type { MoodTag, ReaderIntent } from "@/types/fragment";
import type { MoodAnalysisResult } from "@/types/recommendation";
import { callCloudLLM, extractJSONObject, type LLMConfig } from "./llm";

export const MOOD_OPTIONS: {
  id: MoodTag;
  label_kk: string;
  label_ru: string;
  label_en: string;
  en: string;
}[] = [
  { id: "қуаныш", label_kk: "Қуаныш", label_ru: "Радость", label_en: "Joy", en: "joy" },
  { id: "мұң", label_kk: "Мұң", label_ru: "Грусть", label_en: "Sadness", en: "sadness" },
  { id: "шаршау", label_kk: "Шаршау", label_ru: "Усталость", label_en: "Tiredness", en: "fatigue" },
  { id: "жалғыздық", label_kk: "Жалғыздық", label_ru: "Одиночество", label_en: "Loneliness", en: "loneliness" },
  { id: "ғашықтық", label_kk: "Ғашықтық", label_ru: "Влюблённость", label_en: "Love", en: "love" },
  { id: "уайым", label_kk: "Уайым", label_ru: "Тревога", label_en: "Worry", en: "anxiety" },
  { id: "шабыт", label_kk: "Шабыт", label_ru: "Вдохновение", label_en: "Inspiration", en: "inspiration" },
  { id: "зерігу", label_kk: "Зерігу", label_ru: "Скука", label_en: "Boredom", en: "boredom" },
  { id: "шытырман іздеу", label_kk: "Шытырман іздеу", label_ru: "Жажда приключений", label_en: "Adventure", en: "adventure" },
];

export const INTENT_OPTIONS: {
  id: ReaderIntent;
  label_kk: string;
  label_ru: string;
  label_en: string;
}[] = [
  { id: "күлкі", label_kk: "Күлкі", label_ru: "Улыбнуться", label_en: "Laughter" },
  { id: "үміт", label_kk: "Үміт", label_ru: "Надежда", label_en: "Hope" },
  { id: "тыныштық", label_kk: "Тыныштық", label_ru: "Спокойствие", label_en: "Calm" },
  { id: "түсіну", label_kk: "Түсіну", label_ru: "Понимание", label_en: "Understanding" },
  { id: "оқиғаға ену", label_kk: "Оқиғаға ену", label_ru: "Погрузиться в сюжет", label_en: "Immersion" },
];

const CRISIS_PATTERNS = [
  /өзіме\s*қол\s*жұмса/i,
  /өмір\s*сүргім\s*келмейді/i,
  /өлгім\s*келеді/i,
  /өзімді\s*өлтір/i,
  /суицид/i,
  /жить\s*не\s*хочу/i,
  /покончить\s*с\s*собой/i,
  /убить\s*себя/i,
  /kill\s*myself/i,
  /end\s*my\s*life/i,
  /self[-\s]?harm/i,
];

const MOOD_KEYWORDS: Record<MoodTag, string[]> = {
  қуаныш: ["қуаныш", "бақыт", "көңілді", "күлкі", "жақсы", "керемет", "радост", "счаст", "весел", "хорошо", "happy", "joy", "excited", "great"],
  мұң: ["мұң", "қайғы", "жыла", "ренжі", "күйзеліс", "сағын", "түңіл", "груст", "печал", "тоск", "скучаю", "обид", "sad", "melancholy", "grief", "miss"],
  шаршау: ["шарша", "қажы", "әлсіз", "ұйқы", "демал", "жұмыс", "емтихан", "устал", "измотан", "выгор", "тяжел", "tired", "exhausted", "burnout", "weary"],
  жалғыздық: ["жалғыз", "оңаша", "ешкім", "түсінбейді", "бөтен", "одиноч", "один", "никому", "пусто", "lonely", "alone", "isolated"],
  ғашықтық: ["ғашық", "махаббат", "сүй", "сезім", "жүрек", "сағыныш", "любов", "влюб", "чувств", "нежно", "love", "romance", "crush", "heart"],
  уайым: ["уайым", "қорқ", "үрей", "толқы", "қобалж", "белгісіз", "тревог", "боюсь", "страх", "волну", "пережива", "anxious", "worried", "fear", "stress"],
  шабыт: ["шабыт", "арман", "мақсат", "күш", "жаңа", "ұмтыл", "сенім", "вдохнов", "мечт", "цел", "сил", "мотив", "inspir", "dream", "hope", "motivation"],
  зерігу: ["зерік", "іш пыс", "қызықсыз", "бос", "скуч", "нечего делать", "рутин", "bored", "dull", "routine"],
  "шытырман іздеу": ["шытырман", "құпия", "жұмбақ", "жатақхана", "оқиға", "детектив", "саяхат", "тайна", "загадк", "приключ", "квест", "mystery", "adventure", "thriller", "secret"],
};

const TOPIC_MAP: { topic: string; keywords: string[] }[] = [
  { topic: "университет", keywords: ["универ", "студент", "емтихан", "сессия", "жатақхана", "оқу", "лекция", "коллоквиум", "экзамен", "exam", "study"] },
  { topic: "махаббат", keywords: ["ғашық", "махаббат", "сүй", "любов", "love"] },
  { topic: "достық", keywords: ["дос", "жолдас", "бауыр", "друг", "дружб", "friend"] },
  { topic: "отбасы", keywords: ["әже", "ана", "әке", "үй", "отбасы", "семья", "мама", "home", "family"] },
  { topic: "құпия", keywords: ["құпия", "жұмбақ", "табу", "хат", "есік", "тайна", "загадк", "mystery", "secret"] },
  { topic: "өзін тану", keywords: ["өмір", "мағына", "өзім", "болмыс", "жол", "смысл", "себя", "identity", "purpose"] },
  { topic: "әзіл", keywords: ["күлкі", "әзіл", "қалжың", "юмор", "смех", "funny", "humor"] },
];

export function detectLanguage(text: string): LanguageCode {
  if (/[әіңғүұқөһӘІҢҒҮҰҚӨҺ]/.test(text)) return "kk";
  if (/[а-яА-ЯёЁ]/.test(text)) return "ru";
  if (/[a-zA-Z]/.test(text)) return "en";
  return "kk";
}

export function checkSafetyTrigger(text: string): {
  triggered: boolean;
  message?: string;
} {
  for (const re of CRISIS_PATTERNS) {
    if (re.test(text)) {
      const lang = detectLanguage(text);
      if (lang === "ru") {
        return {
          triggered: true,
          message:
            "Мы слышим, что вам сейчас очень тяжело. Вы не одни — пожалуйста, обратитесь за поддержкой к близкому человеку, психологу или позвоните на горячую линию помощи: 111 или 150 (Казахстан, круглосуточно и бесплатно).",
        };
      }
      if (lang === "en") {
        return {
          triggered: true,
          message:
            "It sounds like you are carrying something very heavy right now. Please reach out to someone you trust or a local support helpline (in Kazakhstan: 111 or 150, 24/7 free support). You matter and do not have to carry this alone.",
        };
      }
      return {
        triggered: true,
        message:
          "Қазір жаныңа өте ауыр тиіп тұрғанын сеземіз. Сен жалғыз емессің — жақын адамыңмен, психологпен сөйлес немесе тәулік бойы тегін көмек желісіне хабарлас: 111 немесе 150 (Қазақстан). Сенің өмірің мен амандығың бәрінен қымбат.",
      };
    }
  }
  return { triggered: false };
}

function defaultIntentForMood(mood: MoodTag): ReaderIntent {
  switch (mood) {
    case "қуаныш":
      return "күлкі";
    case "мұң":
    case "жалғыздық":
      return "түсіну";
    case "шаршау":
    case "уайым":
      return "тыныштық";
    case "шабыт":
    case "ғашықтық":
      return "үміт";
    case "зерігу":
    case "шытырман іздеу":
      return "оқиғаға ену";
  }
}

export async function analyzeMoodInput(params: {
  mood_text?: string;
  selected_mood?: MoodTag;
  intent?: ReaderIntent;
  llmConfig?: LLMConfig;
}): Promise<MoodAnalysisResult> {
  const rawText = (params.mood_text || "").trim().slice(0, 1000);
  const safety = checkSafetyTrigger(rawText);
  if (safety.triggered) {
    return {
      emotion: "уайым",
      emotion_en: "distress",
      topics: ["қолдау"],
      reader_intent: "тыныштық",
      language: detectLanguage(rawText),
      summary_kk: "Қауіпсіз қолдау және көмек хабарламасы көрсетілді.",
      safety_alert: true,
      safety_message: safety.message,
      engine: "offline-mvp",
    };
  }

  const language: LanguageCode = rawText
    ? detectLanguage(rawText)
    : "kk";

  // Try Cloud LLM when API key is configured and there is free-form text
  if (params.llmConfig?.apiKey && rawText.length > 0) {
    const allowedMoods = MOOD_OPTIONS.map((m) => m.id).join(", ");
    const allowedIntents = INTENT_OPTIONS.map((i) => i.id).join(", ");
    const systemPrompt = `You are QAZINA Mood Analyzer. Do NOT provide medical or psychiatric diagnoses. Respect the reader's emotional state.
Classify the text into ONE emotion from [${allowedMoods}], ONE reader_intent from [${allowedIntents}], up to 3 short topic tags (in Kazakh), detected language (kk|ru|en), and a short empathetic 1-sentence Kazakh summary (summary_kk).
Reply ONLY with valid JSON:
{"emotion":"...","topics":["..."],"reader_intent":"...","language":"kk","summary_kk":"..."}`;

    const llmRes = await callCloudLLM(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Reader text: "${rawText}"\nSelected mood hint: "${params.selected_mood || "none"}"\nSelected intent hint: "${params.intent || "none"}"`,
        },
      ],
      params.llmConfig,
      7000,
    );

    if (llmRes) {
      const jsonStr = extractJSONObject(llmRes.content);
      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr);
          const matchedMood = MOOD_OPTIONS.find(
            (m) => m.id === parsed.emotion || m.en === parsed.emotion,
          );
          const matchedIntent = INTENT_OPTIONS.find(
            (i) => i.id === parsed.reader_intent,
          );
          const finalMood = params.selected_mood || matchedMood?.id || "шаршау";
          const finalIntent =
            params.intent || matchedIntent?.id || defaultIntentForMood(finalMood);
          const moodMeta = MOOD_OPTIONS.find((m) => m.id === finalMood)!;

          return {
            emotion: finalMood,
            emotion_en: moodMeta.en,
            topics: Array.isArray(parsed.topics)
              ? parsed.topics.slice(0, 3).map(String)
              : ["өмірлік ізденіс"],
            reader_intent: finalIntent,
            language:
              parsed.language === "ru" || parsed.language === "en"
                ? parsed.language
                : language,
            summary_kk:
              typeof parsed.summary_kk === "string" && parsed.summary_kk.trim()
                ? parsed.summary_kk.trim()
                : `Сенің күйің «${moodMeta.label_kk}» реңкінде сезілді — саған үндесетін оқиға таңдалды.`,
            safety_alert: false,
            engine: "cloud-llm",
            model: llmRes.model,
          };
        } catch {
          // Fall back to deterministic analyzer
        }
      }
    }
  }

  // Deterministic Offline MVP analyzer (<10ms)
  const low = rawText.toLowerCase();
  let detectedMood: MoodTag = params.selected_mood || "шабыт";

  if (!params.selected_mood && low) {
    let bestScore = 0;
    for (const [mood, keys] of Object.entries(MOOD_KEYWORDS) as [
      MoodTag,
      string[],
    ][]) {
      let score = 0;
      for (const kw of keys) {
        if (low.includes(kw)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        detectedMood = mood;
      }
    }
    if (bestScore === 0) {
      detectedMood = low.includes("?") ? "шытырман іздеу" : "шаршау";
    }
  }

  const topics: string[] = [];
  for (const t of TOPIC_MAP) {
    if (t.keywords.some((kw) => low.includes(kw))) {
      topics.push(t.topic);
    }
  }
  if (topics.length === 0) {
    topics.push(detectedMood === "шытырман іздеу" ? "құпия" : "өзін тану");
  }

  const readerIntent = params.intent || defaultIntentForMood(detectedMood);
  const moodMeta =
    MOOD_OPTIONS.find((m) => m.id === detectedMood) || MOOD_OPTIONS[6];

  return {
    emotion: detectedMood,
    emotion_en: moodMeta.en,
    topics: topics.slice(0, 3),
    reader_intent: readerIntent,
    language,
    summary_kk: rawText
      ? `Ойыңнан «${moodMeta.label_kk.toLowerCase()}» және «${readerIntent}» іздеуі байқалады — дәл осы сәтке үндес үзінді дайын.`
      : `«${moodMeta.label_kk}» күйі мен «${readerIntent}» бағытына сәйкес әдеби үзінді таңдалды.`,
    safety_alert: false,
    engine: "offline-mvp",
  };
}
