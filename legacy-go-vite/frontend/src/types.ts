export interface User {
  id: number;
  username: string;
  full_name: string;
  avatar: string;
  bio: string;
  is_demo?: boolean;
}
export interface Book {
  id: number;
  title: string;
  author: string;
  description: string;
  color: string;
  file: string;
  uploader_id: number;
  uploader: string;
  likes: number;
  liked: boolean;
  saved: boolean;
  topic?: string;
  language?: string;
  source_url?: string;
  license?: string;
  pages?: number;
  cover?: string;
  cover_source?: string;
  cover_edition?: string;
}
export interface Post {
  id: number;
  user: User;
  book: Book;
  kind: "quote" | "recommendation";
  quote: string;
  opinion: string;
  page: number;
  lines: string;
  created_at: string;
  likes: number;
  comments: number;
  liked: boolean;
  saved: boolean;
}
export interface Comment {
  id: number;
  user: User;
  body: string;
  created_at: string;
}
export interface Profile {
  user: User;
  followers: number;
  following: number;
  posts: number;
  followed: boolean;
}
export interface MoodExcerpt {
  page: number;
  text: string;
}
export interface MoodPick {
  book: Book;
  why: string;
  excerpt: MoodExcerpt;
}
export interface MoodResult {
  emotion: string;
  summary: string;
  books: MoodPick[];
}
