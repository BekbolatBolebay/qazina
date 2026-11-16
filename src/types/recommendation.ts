import type { LanguageCode } from "./book";
import type { HiddenFragmentPayload, MoodTag, ReaderIntent } from "./fragment";
import type { AgeGroup } from "./user";

export interface MoodAnalysisResult {
  emotion: MoodTag;
  emotion_en: string;
  topics: string[];
  reader_intent: ReaderIntent;
  language: LanguageCode;
  summary_kk: string;
  safety_alert: boolean;
  safety_message?: string;
  engine: "cloud-llm" | "offline-mvp";
  model?: string;
}

export interface RecommendationRequest {
  mood_text?: string;
  selected_mood?: MoodTag;
  intent?: ReaderIntent;
  language?: LanguageCode | "all";
  age_group: AgeGroup;
  exclude_ids?: string[];
  prefer_dialogue?: boolean;
  analysis?: MoodAnalysisResult;
}

export interface RecommendationResponse {
  analysis: MoodAnalysisResult;
  fragment: HiddenFragmentPayload | null;
  remaining_candidates: number;
}

export interface AnalyticsSummary {
  mood_submissions: number;
  fragments_viewed: number;
  fragments_completed: number;
  reveals_clicked: number;
  books_opened: number;
  saves_count: number;
  skips_count: number;
  dilemma_answers: number;
  quest_qr_scans: number;
  quest_chapters_read: number;
  quest_completed: number;
  fragment_completion_rate: number;
  reveal_rate: number;
  book_open_rate: number;
  voluntary_return_rate: number;
}
