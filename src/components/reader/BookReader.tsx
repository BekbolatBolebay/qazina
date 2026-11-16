"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Minus,
  Plus,
  Sparkles,
  Type,
} from "lucide-react";
import { SaveThoughtModal } from "@/components/fragments/SaveThoughtModal";
import { useQazina } from "@/components/layout/QazinaProvider";
import {
  DEFAULT_READER_PREFS,
  loadReaderPrefs,
  saveBookProgress,
  saveReaderPrefs,
  type ReaderPrefs,
} from "@/lib/clientStorage";
import type { Book, Chapter } from "@/types/book";
import type { Fragment } from "@/types/fragment";

interface BookReaderProps {
  book: Book;
  anchorFragment?: Fragment;
  initialChapterId?: string;
}

export function BookReader({
  book,
  anchorFragment,
  initialChapterId,
}: BookReaderProps) {
  const { showToast } = useQazina();
  const chapters = book.chapters;

  const initialIdx = (() => {
    if (anchorFragment) {
      const i = chapters.findIndex((c) => c.id === anchorFragment.chapter_id);
      if (i >= 0) return i;
    }
    if (initialChapterId) {
      const i = chapters.findIndex((c) => c.id === initialChapterId);
      if (i >= 0) return i;
    }
    return 0;
  })();

  const hasPdf = Boolean(book.pdf_preview_url || book.pdf_url);
  const [mode, setMode] = useState<"text" | "pdf">(
    chapters.length === 0 && hasPdf ? "pdf" : "text",
  );
  const [chapterIdx, setChapterIdx] = useState(initialIdx);
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_READER_PREFS);
  const [saveOpen, setSaveOpen] = useState(false);

  const currentChapter: Chapter | undefined = chapters[chapterIdx];

  useEffect(() => {
    setPrefs(loadReaderPrefs());
  }, []);

  useEffect(() => {
    if (!currentChapter) return;
    saveBookProgress({
      book_slug: book.slug,
      book_title: book.title,
      chapter_id: currentChapter.id,
      chapter_title: currentChapter.title,
      anchor: anchorFragment?.id,
      updated_at: new Date().toISOString(),
    });
  }, [book.slug, book.title, currentChapter, anchorFragment?.id]);

  useEffect(() => {
    if (anchorFragment && currentChapter?.id === anchorFragment.chapter_id) {
      const el = document.getElementById("continuation-anchor");
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);
      }
    }
  }, [anchorFragment, currentChapter?.id]);

  function updatePrefs(patch: Partial<ReaderPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveReaderPrefs(next);
      return next;
    });
  }

  const themeClasses =
    prefs.theme === "dark"
      ? "bg-[#141917] text-[#F3EFE7] border-[#2C3733]"
      : prefs.theme === "light"
        ? "bg-white text-[#242424] border-[#EFE8DD]"
        : "bg-[#F8F5EF] text-[#242424] border-[#EFE8DD]";

  function renderChapterContent(ch: Chapter) {
    const content = ch.content;
    const isAnchorChapter =
      anchorFragment && anchorFragment.chapter_id === ch.id;

    if (
      !isAnchorChapter ||
      anchorFragment.start_offset < 0 ||
      anchorFragment.end_offset <= anchorFragment.start_offset
    ) {
      return content.split("\n").map((p, idx) =>
        p.trim() === "" ? (
          <div key={idx} className="h-3" />
        ) : (
          <p key={idx} className="mb-3">
            {p}
          </p>
        ),
      );
    }

    const before = content.slice(0, anchorFragment.start_offset);
    const highlighted = content.slice(
      anchorFragment.start_offset,
      anchorFragment.end_offset,
    );
    const after = content.slice(anchorFragment.end_offset);

    return (
      <>
        {before &&
          before.split("\n").map((p, idx) =>
            p.trim() === "" ? (
              <div key={`b_${idx}`} className="h-3" />
            ) : (
              <p key={`b_${idx}`} className="mb-3 opacity-85">
                {p}
              </p>
            ),
          )}

        <div
          id="continuation-anchor"
          className="my-5 rounded-2xl border-l-4 border-[#B58B54] bg-[#B58B54]/10 p-4"
        >
          <div className="mb-2 flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wider text-[#B58B54]">
            <Sparkles size={13} />
            Сен оқыған үзінді · Осы жерден жалғасады
          </div>
          {highlighted.split("\n").map((p, idx) =>
            p.trim() === "" ? (
              <div key={`h_${idx}`} className="h-2" />
            ) : (
              <p key={`h_${idx}`} className="mb-2 font-medium">
                {p}
              </p>
            ),
          )}
        </div>

        {after && (
          <div className="mt-4">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#173F35] px-3 py-1 font-sans text-xs font-semibold text-white">
              Ары қарай жалғасы ↓
            </div>
            {after.split("\n").map((p, idx) =>
              p.trim() === "" ? (
                <div key={`a_${idx}`} className="h-3" />
              ) : (
                <p key={`a_${idx}`} className="mb-3">
                  {p}
                </p>
              ),
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EFE8DD] bg-white p-4 shadow-sm dark:border-[#2C3733] dark:bg-[#1D2421]">
        <div className="flex items-center gap-3">
          <Link
            href={`/books/${book.slug}`}
            className="rounded-xl bg-[#F8F5EF] p-2 text-[#173F35] hover:bg-[#EFE8DD] dark:bg-[#141917] dark:text-[#D4B382]"
            aria-label="Кітап бетіне оралу"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="literary-text text-base font-bold text-[#173F35] dark:text-[#F3EFE7] sm:text-lg">
              {book.title}
            </h1>
            <p className="text-xs text-[#B58B54]">{book.author}</p>
          </div>
        </div>

        {/* Typography & Reader Theme Controls (Section 10) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-2 py-1 dark:border-[#2C3733] dark:bg-[#141917]">
            <button
              type="button"
              onClick={() =>
                updatePrefs({ fontSize: Math.max(14, prefs.fontSize - 1) })
              }
              className="p-1 hover:text-[#B58B54]"
              aria-label="Қаріпті кішірейту"
            >
              <Minus size={14} />
            </button>
            <span className="px-1 text-xs font-semibold">{prefs.fontSize}px</span>
            <button
              type="button"
              onClick={() =>
                updatePrefs({ fontSize: Math.min(26, prefs.fontSize + 1) })
              }
              className="p-1 hover:text-[#B58B54]"
              aria-label="Қаріпті үлкейту"
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              updatePrefs({
                fontFamily: prefs.fontFamily === "serif" ? "sans" : "serif",
              })
            }
            className="inline-flex items-center gap-1 rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-2.5 py-1.5 text-xs font-semibold dark:border-[#2C3733] dark:bg-[#141917]"
          >
            <Type size={13} />
            {prefs.fontFamily === "serif" ? "Serif" : "Sans"}
          </button>

          <div className="flex rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] p-0.5 text-[11px] font-semibold dark:border-[#2C3733] dark:bg-[#141917]">
            {(
              [
                { id: "warm", label: "Жылы" },
                { id: "light", label: "Ақ" },
                { id: "dark", label: "Түн" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => updatePrefs({ theme: t.id })}
                className={`rounded-lg px-2.5 py-1 ${
                  prefs.theme === t.id
                    ? "bg-[#173F35] text-white"
                    : "text-neutral-600 dark:text-neutral-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {hasPdf && (
            <div className="flex items-center gap-1 rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] p-0.5 text-xs font-bold dark:border-[#2C3733] dark:bg-[#141917]">
              {chapters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 ${
                    mode === "text"
                      ? "bg-[#173F35] text-white"
                      : "text-neutral-600 dark:text-neutral-300"
                  }`}
                >
                  <BookOpen size={13} />
                  Мәтін
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode("pdf")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 ${
                  mode === "pdf"
                    ? "bg-[#173F35] text-white"
                    : "text-neutral-600 dark:text-neutral-300"
                }`}
              >
                <FileText size={13} />
                PDF {book.file_size ? `(${book.file_size})` : ""}
              </button>
              {book.pdf_url && (
                <a
                  href={book.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  title="PDF жүктеу"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[#B58B54] hover:underline"
                >
                  <Download size={13} />
                </a>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#173F35] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#112F28]"
          >
            <BookmarkPlus size={14} />
            Ой сақтау
          </button>
        </div>
      </div>

      {/* Chapter Selector & Progress */}
      {mode === "text" && chapters.length > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#EFE8DD] bg-white px-4 py-2.5 text-xs dark:border-[#2C3733] dark:bg-[#1D2421]">
          <select
            value={chapterIdx}
            onChange={(e) => setChapterIdx(Number(e.target.value))}
            aria-label="Тарау таңдау"
            className="max-w-xs truncate rounded-lg border border-[#EFE8DD] bg-[#F8F5EF] px-2.5 py-1.5 font-semibold text-[#173F35] outline-none dark:border-[#2C3733] dark:bg-[#141917] dark:text-[#F3EFE7]"
          >
            {chapters.map((ch, idx) => (
              <option key={ch.id} value={idx}>
                {ch.title}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 font-semibold text-neutral-500">
            <span>
              Тарау {chapterIdx + 1} / {chapters.length}
            </span>
          </div>
        </div>
      )}

      {/* Main Reader Surface */}
      {mode === "pdf" && book.pdf_preview_url ? (
        <div className="space-y-3 rounded-3xl border border-[#EFE8DD] bg-white p-3 shadow-literary dark:border-[#2C3733] dark:bg-[#1D2421] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-300">
            <span>Түпнұсқа PDF оқу режимі · {book.title}</span>
            {book.pdf_url && (
              <a
                href={book.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#173F35] px-3.5 py-1.5 font-bold text-white"
              >
                <Download size={13} />
                PDF файлын жүктеу
              </a>
            )}
          </div>
          <iframe
            src={book.pdf_preview_url}
            title={`${book.title} PDF`}
            className="h-[78vh] w-full rounded-2xl border border-[#EFE8DD] bg-[#F8F5EF] dark:border-[#2C3733]"
            allow="autoplay"
          />
        </div>
      ) : currentChapter ? (
        <article
          className={`rounded-3xl border p-6 shadow-literary transition sm:p-10 ${themeClasses}`}
          style={{
            fontSize: `${prefs.fontSize}px`,
            lineHeight: prefs.lineHeight,
            fontFamily:
              prefs.fontFamily === "serif"
                ? "var(--font-serif)"
                : "var(--font-sans)",
          }}
        >
          <h2 className="mb-6 border-b border-current/10 pb-3 text-xl font-bold sm:text-2xl">
            {currentChapter.title}
          </h2>

          <div>{renderChapterContent(currentChapter)}</div>

          <div className="mt-8 grid grid-cols-2 gap-3 border-t border-current/10 pt-5 font-sans text-xs sm:mt-10 sm:flex sm:items-center sm:justify-between sm:text-sm">
            <button
              type="button"
              disabled={chapterIdx <= 0}
              onClick={() => {
                setChapterIdx((i) => Math.max(0, i - 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-current/20 px-3 py-2.5 font-semibold disabled:opacity-40 sm:px-4 sm:py-2"
            >
              <ChevronLeft size={16} />
              Алдыңғы бөлім
            </button>

            {chapterIdx < chapters.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  setChapterIdx((i) => Math.min(chapters.length - 1, i + 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#173F35] px-4 py-2.5 font-semibold text-white hover:bg-[#112F28] sm:px-5 sm:py-2"
              >
                Келесі бөлім
                <ChevronRight size={16} />
              </button>
            ) : (
              <Link
                href={book.is_quest ? "/quest" : "/discover"}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#B58B54] px-4 py-2.5 font-semibold text-white sm:px-5 sm:py-2"
              >
                {book.is_quest ? "Квест пазлына өту" : "Басқа оқиға табу"}
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </article>
      ) : (
        <div className="rounded-3xl border border-[#EFE8DD] bg-white p-8 text-center dark:border-[#2C3733] dark:bg-[#1D2421]">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Бұл кітаптың толық цифрлық мәтіні құқық растауынан өтіп жатыр.
          </p>
        </div>
      )}

      {currentChapter && (
        <SaveThoughtModal
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          fragmentId={anchorFragment?.id || `${book.id}_${currentChapter.id}`}
          text={anchorFragment?.text || currentChapter.content.slice(0, 320)}
          revealed
          bookSlug={book.slug}
          bookTitle={book.title}
          author={book.author}
          chapterId={currentChapter.id}
          onSaved={() => showToast("Оқыған жерің жинаққа сақталды")}
        />
      )}
    </div>
  );
}
