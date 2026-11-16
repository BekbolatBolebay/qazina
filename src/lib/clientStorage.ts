import type { LanguageCode } from "@/types/book";
import type {
  CollectionCategory,
  CollectionColor,
  ReadingProgress,
  SavedFragmentItem,
  UserProfile,
} from "@/types/user";

const KEYS = {
  SAVED: "qazina_saved_fragments_v1",
  PROFILE: "qazina_profile_v1",
  PROGRESS: "qazina_reading_progress_v1",
  LLM: "qazina_llm_settings_v1",
  QUEST: "qazina_quest_state_v1",
  READER_PREFS: "qazina_reader_prefs_v1",
};

export interface ClientLLMSettings {
  apiUrl: string;
  apiKey: string;
  model: string;
}

export interface QuestClientState {
  unlockedChapters: number;
  foundClues: string[];
  puzzleOrder: string[];
  puzzleSolved: boolean;
}

export interface ReaderPrefs {
  fontSize: number;
  lineHeight: number;
  theme: "warm" | "light" | "dark";
  fontFamily: "serif" | "sans";
}

export const DEFAULT_PROFILE: UserProfile = {
  id: "local_reader",
  display_name: "Оқырман",
  avatar_emoji: "🌿",
  language: "kk",
  age_group: "18-24",
  role: "Reader",
  save_mood_journal: false,
  dark_mode: false,
  reading_history: [],
};

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  fontSize: 18,
  lineHeight: 1.8,
  theme: "warm",
  fontFamily: "serif",
};

export const COLLECTION_CATEGORIES: {
  id: CollectionCategory;
  color: CollectionColor;
  badgeClass: string;
}[] = [
  { id: "Жүрегіме жақын", color: "green", badgeClass: "bg-[#173F35] text-white" },
  { id: "Ойландырды", color: "gold", badgeClass: "bg-[#B58B54] text-white" },
  { id: "Күлдірді", color: "sand", badgeClass: "bg-[#EFE8DD] text-[#242424]" },
  { id: "Шабыт берді", color: "terracotta", badgeClass: "bg-[#8C4A3B] text-white" },
  { id: "Кейін оқимын", color: "slate", badgeClass: "bg-[#385663] text-white" },
];

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

export function loadSavedFragments(): SavedFragmentItem[] {
  return safeRead<SavedFragmentItem[]>(KEYS.SAVED, []);
}

export function saveFragmentLocal(item: SavedFragmentItem): SavedFragmentItem[] {
  const list = loadSavedFragments();
  const idx = list.findIndex((i) => i.fragment_id === item.fragment_id);
  const next =
    idx >= 0
      ? list.map((i, k) => (k === idx ? item : i))
      : [item, ...list];
  safeWrite(KEYS.SAVED, next);
  return next;
}

export function removeSavedFragmentLocal(idOrFragId: string): SavedFragmentItem[] {
  const list = loadSavedFragments().filter(
    (i) => i.id !== idOrFragId && i.fragment_id !== idOrFragId,
  );
  safeWrite(KEYS.SAVED, list);
  return list;
}

export function loadUserProfile(): UserProfile {
  return { ...DEFAULT_PROFILE, ...safeRead<Partial<UserProfile>>(KEYS.PROFILE, {}) };
}

export function saveUserProfile(profile: UserProfile): void {
  safeWrite(KEYS.PROFILE, profile);
}

export function setProfileLanguage(lang: LanguageCode): UserProfile {
  const p = loadUserProfile();
  const next = { ...p, language: lang };
  saveUserProfile(next);
  return next;
}

export function loadReadingProgress(): Record<string, ReadingProgress> {
  return safeRead<Record<string, ReadingProgress>>(KEYS.PROGRESS, {});
}

export function saveBookProgress(progress: ReadingProgress): void {
  const map = loadReadingProgress();
  map[progress.book_slug] = progress;
  safeWrite(KEYS.PROGRESS, map);

  const profile = loadUserProfile();
  const filtered = profile.reading_history.filter(
    (h) => h.book_slug !== progress.book_slug,
  );
  profile.reading_history = [progress, ...filtered].slice(0, 12);
  saveUserProfile(profile);
}

export function loadLLMSettings(): ClientLLMSettings {
  return safeRead<ClientLLMSettings>(KEYS.LLM, {
    apiUrl: "https://llm.alem.ai/v1/chat/completions",
    apiKey: "",
    model: "qwen3-8",
  });
}

export function saveLLMSettings(settings: ClientLLMSettings): void {
  safeWrite(KEYS.LLM, settings);
}

export function buildLLMHeaders(): Record<string, string> {
  const s = loadLLMSettings();
  const headers: Record<string, string> = {};
  if (s.apiKey.trim()) headers["x-llm-api-key"] = s.apiKey.trim();
  if (s.apiUrl.trim()) headers["x-llm-api-url"] = s.apiUrl.trim();
  if (s.model.trim()) headers["x-llm-model"] = s.model.trim();
  return headers;
}

export function loadQuestState(defaultOrder: string[]): QuestClientState {
  const raw = safeRead<Partial<QuestClientState>>(KEYS.QUEST, {});
  return {
    unlockedChapters: raw.unlockedChapters || 1,
    foundClues: raw.foundClues || [],
    puzzleOrder:
      raw.puzzleOrder && raw.puzzleOrder.length === defaultOrder.length
        ? raw.puzzleOrder
        : defaultOrder,
    puzzleSolved: Boolean(raw.puzzleSolved),
  };
}

export function saveQuestState(state: QuestClientState): void {
  safeWrite(KEYS.QUEST, state);
}

export function loadReaderPrefs(): ReaderPrefs {
  return { ...DEFAULT_READER_PREFS, ...safeRead<Partial<ReaderPrefs>>(KEYS.READER_PREFS, {}) };
}

export function saveReaderPrefs(prefs: ReaderPrefs): void {
  safeWrite(KEYS.READER_PREFS, prefs);
}
