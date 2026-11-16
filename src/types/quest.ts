export interface QuestChapter {
  id: string;
  number: number;
  title: string;
  location_hint: string;
  time_label: string;
  word_count: number;
  text: string;
  ending_hook: string;
  is_final?: boolean;
}

export interface QuestClue {
  id: string;
  order_index: number;
  chapter_number: number;
  title: string;
  location_name: string;
  location_detail: string;
  excerpt: string;
  intrigue_line: string;
  qr_path: string;
  secret_hint: string;
}

export interface DormQuestData {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  genre: string[];
  author: string;
  target_audience: string;
  total_words: number;
  chapters: QuestChapter[];
  clues: QuestClue[];
  final_qr_prompt: string;
  secret_archive_unlock: string;
}
