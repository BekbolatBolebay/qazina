import fs from "fs";
import path from "path";
import initialMoments from "@/data/moments.json";
import type { AnalyticsSummary } from "@/types/recommendation";
import type { MomentPost, SavedFragmentItem, UserProfile } from "@/types/user";

export interface ServerStoreState {
  analytics: {
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
    returning_sessions: number;
    total_sessions: number;
  };
  saved: SavedFragmentItem[];
  profile: UserProfile;
  moments: MomentPost[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "qazina-store.json");

const DEFAULT_STATE: ServerStoreState = {
  analytics: {
    mood_submissions: 42,
    fragments_viewed: 56,
    fragments_completed: 44,
    reveals_clicked: 31,
    books_opened: 23,
    saves_count: 18,
    skips_count: 14,
    dilemma_answers: 19,
    quest_qr_scans: 27,
    quest_chapters_read: 84,
    quest_completed: 9,
    returning_sessions: 16,
    total_sessions: 38,
  },
  saved: [],
  profile: {
    id: "reader_local_1",
    display_name: "Қонақ Оқырман",
    avatar_emoji: "📖",
    language: "kk",
    age_group: "18-24",
    role: "Reader",
    save_mood_journal: false,
    dark_mode: false,
    reading_history: [],
  },
  moments: initialMoments as MomentPost[],
};

let memoryStore: ServerStoreState | null = null;

function readStore(): ServerStoreState {
  if (memoryStore) return memoryStore;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf8");
      const parsed = JSON.parse(raw) as Partial<ServerStoreState>;
      memoryStore = {
        analytics: { ...DEFAULT_STATE.analytics, ...(parsed.analytics || {}) },
        saved: Array.isArray(parsed.saved) ? parsed.saved : [],
        profile: { ...DEFAULT_STATE.profile, ...(parsed.profile || {}) },
        moments: Array.isArray(parsed.moments)
          ? parsed.moments
          : (initialMoments as MomentPost[]),
      };
      return memoryStore;
    }
  } catch {
    // fallback to default in memory
  }
  memoryStore = structuredClone(DEFAULT_STATE);
  return memoryStore;
}

function writeStore(state: ServerStoreState): void {
  memoryStore = state;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Ignore filesystem errors in read-only environments
  }
}

export type AnalyticsEventType =
  | "mood_submission"
  | "fragment_view"
  | "fragment_complete"
  | "reveal"
  | "book_open"
  | "save"
  | "skip"
  | "dilemma"
  | "quest_qr_scan"
  | "quest_chapter_read"
  | "quest_complete";

export function trackAnalyticsEvent(event: AnalyticsEventType): AnalyticsSummary {
  const store = readStore();
  switch (event) {
    case "mood_submission":
      store.analytics.mood_submissions++;
      break;
    case "fragment_view":
      store.analytics.fragments_viewed++;
      break;
    case "fragment_complete":
      store.analytics.fragments_completed++;
      break;
    case "reveal":
      store.analytics.reveals_clicked++;
      break;
    case "book_open":
      store.analytics.books_opened++;
      break;
    case "save":
      store.analytics.saves_count++;
      break;
    case "skip":
      store.analytics.skips_count++;
      break;
    case "dilemma":
      store.analytics.dilemma_answers++;
      break;
    case "quest_qr_scan":
      store.analytics.quest_qr_scans++;
      break;
    case "quest_chapter_read":
      store.analytics.quest_chapters_read++;
      break;
    case "quest_complete":
      store.analytics.quest_completed++;
      break;
  }
  writeStore(store);
  return getAnalyticsSummary();
}

export function getAnalyticsSummary(): AnalyticsSummary {
  const { analytics: a } = readStore();
  const views = Math.max(1, a.fragments_viewed);
  const reveals = Math.max(1, a.reveals_clicked);
  const sessions = Math.max(1, a.total_sessions);

  return {
    mood_submissions: a.mood_submissions,
    fragments_viewed: a.fragments_viewed,
    fragments_completed: a.fragments_completed,
    reveals_clicked: a.reveals_clicked,
    books_opened: a.books_opened,
    saves_count: a.saves_count,
    skips_count: a.skips_count,
    dilemma_answers: a.dilemma_answers,
    quest_qr_scans: a.quest_qr_scans,
    quest_chapters_read: a.quest_chapters_read,
    quest_completed: a.quest_completed,
    fragment_completion_rate: Math.round((a.fragments_completed / views) * 100),
    reveal_rate: Math.round((a.reveals_clicked / views) * 100),
    book_open_rate: Math.round((a.books_opened / reveals) * 100),
    voluntary_return_rate: Math.round((a.returning_sessions / sessions) * 100),
  };
}

export function getServerSavedItems(): SavedFragmentItem[] {
  return readStore().saved;
}

export function addServerSavedItem(item: SavedFragmentItem): SavedFragmentItem[] {
  const store = readStore();
  const existing = store.saved.findIndex(
    (s) => s.fragment_id === item.fragment_id,
  );
  if (existing >= 0) {
    store.saved[existing] = item;
  } else {
    store.saved.unshift(item);
    store.analytics.saves_count++;
  }
  writeStore(store);
  return store.saved;
}

export function deleteServerSavedItem(id: string): SavedFragmentItem[] {
  const store = readStore();
  store.saved = store.saved.filter((s) => s.id !== id && s.fragment_id !== id);
  writeStore(store);
  return store.saved;
}

export function getServerProfile(): UserProfile {
  return readStore().profile;
}

export function updateServerProfile(
  patch: Partial<UserProfile>,
): UserProfile {
  const store = readStore();
  store.profile = { ...store.profile, ...patch };
  writeStore(store);
  return store.profile;
}

export function getServerMoments(): MomentPost[] {
  return readStore().moments;
}

export function addServerMoment(post: MomentPost): MomentPost[] {
  const store = readStore();
  store.moments.unshift(post);
  writeStore(store);
  return store.moments;
}

export function likeServerMoment(id: string): MomentPost[] {
  const store = readStore();
  store.moments = store.moments.map((m) =>
    m.id === id ? { ...m, likes: m.likes + 1 } : m,
  );
  writeStore(store);
  return store.moments;
}
