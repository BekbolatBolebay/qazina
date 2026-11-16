export type LanguageCode = "kk" | "ru" | "en";

export type RightsStatus =
  | "public_domain"
  | "licensed"
  | "original_quest"
  | "approved"
  | "review_required";

export interface Chapter {
  id: string;
  book_id: string;
  title: string;
  order: number;
  content: string;
}

export interface Book {
  id: string;
  slug: string;
  title: string;
  author: string;
  language: LanguageCode;
  genre: string;
  year?: number;
  age_min: number;
  rights_status: RightsStatus;
  rights_note: string;
  source_url: string;
  cover_color: string;
  cover_badge?: string;
  description: string;
  character_archetype?: string;
  drive_file_id?: string;
  pdf_url?: string;
  pdf_preview_url?: string;
  file_size?: string;
  chapters: Chapter[];
  total_chapters?: number;
  is_quest?: boolean;
}
