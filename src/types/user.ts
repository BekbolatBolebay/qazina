import type { LanguageCode } from "./book";

export type AgeGroup = "10-13" | "14-17" | "18-24" | "25+";

export type UserRole =
  | "Reader"
  | "Content Editor"
  | "Moderator"
  | "Analyst"
  | "Super Admin";

export type CollectionCategory =
  | "Жүрегіме жақын"
  | "Ойландырды"
  | "Күлдірді"
  | "Шабыт берді"
  | "Кейін оқимын";

export type CollectionColor =
  | "green"
  | "gold"
  | "sand"
  | "terracotta"
  | "slate";

export interface SavedFragmentItem {
  id: string;
  fragment_id: string;
  text: string;
  revealed: boolean;
  book_slug?: string;
  book_title?: string;
  author?: string;
  chapter_id?: string;
  category: CollectionCategory;
  color: CollectionColor;
  note: string;
  saved_at: string;
}

export interface ReadingProgress {
  book_slug: string;
  book_title: string;
  chapter_id: string;
  chapter_title: string;
  anchor?: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  display_name: string;
  avatar_emoji: string;
  language: LanguageCode;
  age_group: AgeGroup;
  role: UserRole;
  save_mood_journal: boolean;
  dark_mode: boolean;
  reading_history: ReadingProgress[];
}

export interface MomentPost {
  id: string;
  author_name: string;
  author_handle: string;
  kind: "үзінді" | "пікір" | "сұрақ" | "әсер";
  book_title: string;
  book_slug: string;
  quote?: string;
  body: string;
  likes: number;
  comments: { id: string; author: string; text: string; created_at: string }[];
  created_at: string;
}
