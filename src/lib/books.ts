import booksCore from "@/data/books.json";
import catalogExtra from "@/data/catalog-extra.json";
import questData from "@/data/quest-dorm-secret.json";
import type { Book, Chapter } from "@/types/book";
import type { DormQuestData } from "@/types/quest";
import type { AgeGroup } from "@/types/user";

const quest = questData as DormQuestData;

const questBook: Book = {
  id: "book_quest_dorm",
  slug: quest.slug,
  title: quest.title,
  author: quest.author,
  language: "kk",
  genre: "Мистикалық триллер / Интерактивті квест",
  year: 2026,
  age_min: 12,
  rights_status: "original_quest",
  rights_note: "QAZINA Original Storytelling Quest",
  source_url: "/quest",
  cover_color: "#173F35",
  cover_badge: "Интерактивті квест · 16 бөлім",
  description:
    "Студенттік жатақханада есік астынан табылған көк конверт, 404-бөлменің құпиясы және ашық финалмен аяқталатын 16 бөлімдік интерактивті оқиға.",
  character_archetype: "Шындықтың ізіне түскен зерттеуші студент",
  is_quest: true,
  chapters: quest.chapters.map((ch) => ({
    id: ch.id,
    book_id: "book_quest_dorm",
    title: ch.title,
    order: ch.number,
    content: ch.text,
  })),
  total_chapters: quest.chapters.length,
};

const ALL_BOOKS: Book[] = [
  questBook,
  ...(booksCore as Book[]).map((b) => ({
    ...b,
    total_chapters: b.chapters.length,
  })),
  ...(catalogExtra as Book[]).map((b) => ({
    ...b,
    total_chapters: b.chapters.length,
  })),
];

export function getQuestData(): DormQuestData {
  return quest;
}

export function getAllBooks(): Book[] {
  return ALL_BOOKS;
}

export function getReadableBooks(): Book[] {
  return ALL_BOOKS.filter((b) => b.chapters && b.chapters.length > 0);
}

export function getBookBySlug(slug: string): Book | undefined {
  return ALL_BOOKS.find((b) => b.slug === slug);
}

export function getBookById(id: string): Book | undefined {
  return ALL_BOOKS.find((b) => b.id === id);
}

export function getChaptersBySlug(slug: string): Chapter[] {
  return getBookBySlug(slug)?.chapters || [];
}

export function maxAllowedAgeForGroup(ageGroup: AgeGroup): number {
  switch (ageGroup) {
    case "10-13":
      return 13;
    case "14-17":
      return 17;
    case "18-24":
      return 24;
    case "25+":
      return 99;
  }
}

export function isRightsApproved(status: Book["rights_status"]): boolean {
  return (
    status === "public_domain" ||
    status === "licensed" ||
    status === "original_quest" ||
    status === "approved"
  );
}
