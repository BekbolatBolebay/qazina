import fragmentsRaw from "@/data/fragments.json";
import type { Fragment, RevealPayload } from "@/types/fragment";
import { getBookById } from "./books";

const FRAGMENTS: Fragment[] = fragmentsRaw as Fragment[];

export function getAllFragments(): Fragment[] {
  return FRAGMENTS;
}

export function getApprovedFragments(): Fragment[] {
  return FRAGMENTS.filter((f) => f.review_status === "approved");
}

export function getFragmentById(id: string): Fragment | undefined {
  return FRAGMENTS.find((f) => f.id === id);
}

export function buildRevealPayload(
  fragment: Fragment,
  customExplanation?: string,
): RevealPayload | null {
  const book = getBookById(fragment.book_id);
  if (!book) return null;

  const chapter = book.chapters.find((c) => c.id === fragment.chapter_id);
  const continuationRaw = chapter
    ? chapter.content.slice(Math.max(0, fragment.end_offset)).trim()
    : "";
  const continuationPreview = continuationRaw
    ? continuationRaw
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const explanation =
    customExplanation ||
    `${fragment.character_name} дәл қазір сенің күйіңе ұқсас сәтті бастан өткеруде: ${fragment.character_situation}`;

  return {
    fragment_id: fragment.id,
    revealed: true,
    book_id: book.id,
    book_slug: book.slug,
    book_title: book.title,
    author: book.author,
    language: book.language,
    genre: book.genre,
    year: book.year,
    description: book.description,
    cover_color: book.cover_color,
    rights_note: book.rights_note,
    source_url: book.source_url,
    chapter_id: fragment.chapter_id,
    chapter_title: chapter?.title || "Тарау",
    continuation_anchor: fragment.continuation_anchor,
    continuation_preview: continuationPreview,
    reader_url: `/read/${book.slug}?anchor=${encodeURIComponent(fragment.id)}`,
    character_match: {
      character_name: fragment.character_name,
      situation: fragment.character_situation,
      explanation,
    },
  };
}
