import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { getBookBySlug } from "@/lib/books";
import { getAllFragments } from "@/lib/fragments";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = getBookBySlug(slug);
  if (!book) notFound();

  const fragments = getAllFragments().filter((f) => f.book_id === book.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/books"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#173F35] hover:text-[#B58B54] dark:text-[#D4B382]"
      >
        <ArrowLeft size={14} />
        Кітап қорына оралу
      </Link>

      <div className="rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-literary dark:border-[#2C3733] dark:bg-[#1D2421] sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div
            className="flex h-52 w-36 shrink-0 flex-col justify-between rounded-2xl p-4 text-white shadow-md"
            style={{ backgroundColor: book.cover_color }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
              {book.language.toUpperCase()} · {book.age_min}+
            </span>
            <div>
              <div className="literary-text text-base font-bold leading-snug">
                {book.title}
              </div>
              <div className="mt-1 text-xs text-white/85">{book.author}</div>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#EFE8DD] px-3 py-1 text-xs font-semibold text-[#173F35] dark:bg-[#26302C] dark:text-[#D4B382]">
                {book.genre}
              </span>
              {book.year && (
                <span className="text-xs font-medium text-neutral-500">
                  {book.year} ж.
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <ShieldCheck size={14} />
                {book.rights_note}
              </span>
            </div>

            <h1 className="literary-text text-2xl font-bold text-[#173F35] dark:text-[#F3EFE7] sm:text-3xl">
              {book.title}
            </h1>
            <p className="text-sm font-semibold text-[#B58B54]">{book.author}</p>
            <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
              {book.description}
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              {(book.chapters.length > 0 || book.pdf_preview_url) && (
                <Link
                  href={`/read/${book.slug}`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#173F35] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#112F28]"
                >
                  <BookOpen size={16} />
                  {book.chapters.length > 0 ? "Толық мәтінді оқу" : "PDF кітапты оқу"}
                </Link>
              )}

              {book.pdf_url && (
                <a
                  href={book.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-[#B58B54] px-4 py-2.5 text-xs font-bold text-[#173F35] hover:bg-[#EFE8DD] dark:text-[#D4B382]"
                >
                  PDF жүктеу {book.file_size ? `(${book.file_size})` : ""}
                  <ExternalLink size={13} />
                </a>
              )}

              {book.is_quest && (
                <Link
                  href="/quest"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#B58B54] px-5 py-2.5 text-sm font-bold text-white"
                >
                  Квест режимінде оқу →
                </Link>
              )}

              {book.source_url.startsWith("http") && (
                <a
                  href={book.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-[#EFE8DD] px-4 py-2.5 text-xs font-semibold hover:border-[#B58B54] dark:border-[#2C3733]"
                >
                  Дереккөз
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {book.chapters.length > 0 && (
        <section className="rounded-3xl border border-[#EFE8DD] bg-white p-6 dark:border-[#2C3733] dark:bg-[#1D2421]">
          <h2 className="mb-3 text-lg font-bold text-[#173F35] dark:text-[#F3EFE7]">
            Тараулар ({book.chapters.length})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {book.chapters.map((ch) => (
              <Link
                key={ch.id}
                href={`/read/${book.slug}?chapter=${ch.id}`}
                className="flex items-center justify-between rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-4 py-2.5 text-sm font-medium transition hover:border-[#B58B54] dark:border-[#2C3733] dark:bg-[#141917]"
              >
                <span className="truncate">{ch.title}</span>
                <span className="text-xs font-bold text-[#B58B54]">Оқу →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {fragments.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#173F35] dark:text-[#F3EFE7]">
            <Sparkles size={18} className="text-[#B58B54]" />
            Тексерілген үзінділер ({fragments.length})
          </h2>
          {fragments.map((f) => (
            <div
              key={f.id}
              className="rounded-2xl border border-[#EFE8DD] bg-white p-5 dark:border-[#2C3733] dark:bg-[#1D2421]"
            >
              <div className="mb-2 flex flex-wrap gap-1.5">
                {f.moods.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-[#EFE8DD] px-2.5 py-0.5 text-[11px] font-semibold text-[#173F35] dark:bg-[#26302C] dark:text-[#D4B382]"
                  >
                    {m}
                  </span>
                ))}
              </div>
              <p className="literary-text whitespace-pre-line text-sm leading-relaxed">
                {f.text}
              </p>
              <div className="mt-3 flex justify-end">
                <Link
                  href={`/read/${book.slug}?anchor=${f.id}`}
                  className="text-xs font-bold text-[#173F35] underline hover:text-[#B58B54] dark:text-[#D4B382]"
                >
                  Осы жерден кітапты жалғастыру →
                </Link>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
