"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, KeySquare, Search, ShieldCheck } from "lucide-react";
import { useQazina } from "@/components/layout/QazinaProvider";
import type { Book, LanguageCode } from "@/types/book";

type BookMeta = Omit<Book, "chapters"> & { total_chapters: number };

export default function BooksPage() {
  const { profile } = useQazina();
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<LanguageCode | "all">("all");
  const [readableOnly, setReadableOnly] = useState(false);
  const [respectAge, setRespectAge] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (lang !== "all") params.set("lang", lang);
    if (readableOnly) params.set("readable", "1");
    if (respectAge) params.set("age_group", profile.age_group);

    setLoading(true);
    fetch(`/api/books?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setBooks(d.books || []))
      .finally(() => setLoading(false));
  }, [q, lang, readableOnly, respectAge, profile.age_group]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-card dark:border-[#2C3733] dark:bg-[#1D2421]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="literary-text text-2xl font-bold text-[#173F35] dark:text-[#F3EFE7]">
              QAZINA Кітап қоры ({books.length})
            </h1>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
              Қазақ және әлем әдебиетінің тексерілген каталогы (44 кітап · жас және құқық сүзгісімен)
            </p>
          </div>
          <Link
            href="/quest"
            className="inline-flex items-center gap-2 rounded-xl bg-[#173F35] px-4 py-2 text-xs font-bold text-white"
          >
            <KeySquare size={14} className="text-[#D4B382]" />
            Квест: Жатақхана құпиясы
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Кітап атауы, автор немесе жанр..."
              className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#173F35] dark:border-[#2C3733] dark:bg-[#141917]"
            />
          </div>

          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as LanguageCode | "all")}
            aria-label="Тіл сүзгісі"
            className="rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3 py-2.5 text-xs font-semibold outline-none dark:border-[#2C3733] dark:bg-[#141917]"
          >
            <option value="all">Барлық тілдер</option>
            <option value="kk">Қазақша (KK)</option>
            <option value="ru">Русский (RU)</option>
            <option value="en">English (EN)</option>
          </select>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3 py-2 text-xs font-semibold dark:border-[#2C3733] dark:bg-[#141917]">
            <input
              type="checkbox"
              checked={readableOnly}
              onChange={(e) => setReadableOnly(e.target.checked)}
              className="accent-[#173F35]"
            />
            Тек толық мәтіні барлар
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3 py-2 text-xs font-semibold dark:border-[#2C3733] dark:bg-[#141917]">
            <input
              type="checkbox"
              checked={respectAge}
              onChange={(e) => setRespectAge(e.target.checked)}
              className="accent-[#173F35]"
            />
            Жас сүзгісі ({profile.age_group})
          </label>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-neutral-500">
          Кітаптар жүктелуде...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => {
            const readable = book.total_chapters > 0 || Boolean(book.pdf_preview_url);
            return (
              <div
                key={book.id}
                className="flex flex-col justify-between rounded-2xl border border-[#EFE8DD] bg-white p-5 shadow-sm transition hover:border-[#B58B54] dark:border-[#2C3733] dark:bg-[#1D2421]"
              >
                <div>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div
                      className="flex h-12 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
                      style={{ backgroundColor: book.cover_color }}
                    >
                      {book.language.toUpperCase()}
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <span className="rounded-full bg-[#EFE8DD] px-2 py-0.5 text-[10px] font-bold text-[#173F35] dark:bg-[#26302C] dark:text-[#D4B382]">
                        {book.age_min}+
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          book.rights_status === "review_required"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                        }`}
                      >
                        <ShieldCheck size={10} />
                        {book.rights_status === "review_required"
                          ? "Құқық тексеруде"
                          : "Расталған"}
                      </span>
                    </div>
                  </div>

                  <Link href={`/books/${book.slug}`}>
                    <h2 className="literary-text text-lg font-bold text-[#173F35] hover:text-[#B58B54] dark:text-[#F3EFE7]">
                      {book.title}
                    </h2>
                  </Link>
                  <p className="text-xs font-semibold text-[#B58B54]">
                    {book.author} · {book.genre}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                    {book.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#EFE8DD] pt-3 dark:border-[#26302C]">
                  <span className="text-[11px] font-medium text-neutral-500">
                    {book.total_chapters > 0
                      ? `${book.total_chapters} бөлім${book.pdf_url ? ` · PDF (${book.file_size || ""})` : ""}`
                      : book.pdf_url
                        ? `Түпнұсқа PDF (${book.file_size || ""})`
                        : "Каталог карточкасы"}
                  </span>

                  <div className="flex gap-2">
                    <Link
                      href={`/books/${book.slug}`}
                      className="rounded-lg border border-[#EFE8DD] px-3 py-1.5 text-xs font-semibold hover:border-[#B58B54] dark:border-[#2C3733]"
                    >
                      Толығырақ
                    </Link>
                    {readable && (
                      <Link
                        href={`/read/${book.slug}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#173F35] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#112F28]"
                      >
                        <BookOpen size={12} />
                        Оқу
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
