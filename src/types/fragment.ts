import type { LanguageCode } from "./book";

export type FragmentType = "dialogue" | "prose" | "monologue" | "poetry";

export type DialogueCategory =
  | "әзіл"
  | "тосын шешім"
  | "достық"
  | "махаббат"
  | "батылдық"
  | "қорқыныш"
  | "таңдау"
  | "отбасы"
  | "адамгершілік"
  | "тартыс"
  | "философия";

export type MoodTag =
  | "қуаныш"
  | "мұң"
  | "шаршау"
  | "жалғыздық"
  | "ғашықтық"
  | "уайым"
  | "шабыт"
  | "зерігу"
  | "шытырман іздеу";

export type ReaderIntent =
  | "күлкі"
  | "үміт"
  | "тыныштық"
  | "түсіну"
  | "оқиғаға ену";

export interface DilemmaPrompt {
  question: string;
  options: string[];
}

export interface Fragment {
  id: string;
  book_id: string;
  chapter_id: string;
  start_offset: number;
  end_offset: number;
  continuation_anchor: string;
  text: string;
  type: FragmentType;
  language: LanguageCode;
  dialogue_category?: DialogueCategory;
  moods: MoodTag[];
  topics: string[];
  reader_intents: ReaderIntent[];
  hook_score: number;
  dialogue_score: number;
  emotional_relevance: number;
  readability: number;
  context_clarity: number;
  age_min: number;
  review_status: "approved" | "pending" | "rejected";
  character_name: string;
  character_situation: string;
  dilemma?: DilemmaPrompt;
}

export interface HiddenFragmentPayload {
  fragment_id: string;
  text: string;
  type: FragmentType;
  language: LanguageCode;
  dialogue_category?: DialogueCategory;
  moods: MoodTag[];
  topics: string[];
  revealed: false;
  ranking_score: number;
  score_breakdown: {
    mood_match: number;
    hook_score: number;
    dialogue_quality: number;
    emotional_relevance: number;
    readability: number;
    context_clarity: number;
  };
  dilemma?: DilemmaPrompt;
  actions: ("like" | "save" | "share" | "reveal" | "skip")[];
  engine_mode: "cloud-llm" | "offline-mvp";
  engine_model?: string;
}

export interface RevealPayload {
  fragment_id: string;
  revealed: true;
  book_id: string;
  book_slug: string;
  book_title: string;
  author: string;
  language: LanguageCode;
  genre: string;
  year?: number;
  description: string;
  cover_color: string;
  rights_note: string;
  source_url: string;
  chapter_id: string;
  chapter_title: string;
  continuation_anchor: string;
  continuation_preview: string[];
  reader_url: string;
  character_match: {
    character_name: string;
    situation: string;
    explanation: string;
  };
}
