import type { Chapter } from "@/types/book";
import type { Fragment } from "@/types/fragment";

export interface BookPage {
  pageNumber: number;
  chapterId: string;
  chapterTitle: string;
  text: string;
  hasAnchor: boolean;
}

const TARGET_PAGE_CHARS = 1050;

export function paginateChapters(
  chapters: Chapter[],
  anchorFragment?: Fragment,
): { pages: BookPage[]; anchorPageIndex: number } {
  const pages: BookPage[] = [];
  let anchorPageIndex = 0;

  for (const ch of chapters) {
    const paragraphs = ch.content
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (paragraphs.length === 0) continue;

    let buf: string[] = [];
    let bufLen = 0;

    const flush = () => {
      if (buf.length === 0) return;
      const text = buf.join("\n\n");
      const hasAnchor = Boolean(
        anchorFragment &&
          anchorFragment.chapter_id === ch.id &&
          (text.includes(anchorFragment.text) ||
            text.includes(anchorFragment.text.slice(0, 60))),
      );
      if (hasAnchor) {
        anchorPageIndex = pages.length;
      }
      pages.push({
        pageNumber: pages.length + 1,
        chapterId: ch.id,
        chapterTitle: ch.title,
        text,
        hasAnchor,
      });
      buf = [];
      bufLen = 0;
    };

    for (const para of paragraphs) {
      if (bufLen > 0 && bufLen + para.length > TARGET_PAGE_CHARS) {
        flush();
      }
      buf.push(para);
      bufLen += para.length;
      if (bufLen >= TARGET_PAGE_CHARS) {
        flush();
      }
    }
    flush();
  }

  return { pages, anchorPageIndex };
}
