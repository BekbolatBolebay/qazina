"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, CheckCircle2, Database, QrCode, ShieldCheck, Sparkles } from "lucide-react";
import type { Book } from "@/types/book";
import type { AnalyticsSummary } from "@/types/recommendation";

type BookMeta = Omit<Book, "chapters"> & { total_chapters: number };

interface StorageStatus {
  connected: boolean;
  studio_url: string;
  minio_bucket: string;
  books_count: number;
  fragments_count: number;
  drive_pdfs_count: number;
}

export default function AdminPage() {
  const [kpi, setKpi] = useState<AnalyticsSummary | null>(null);
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [storage, setStorage] = useState<StorageStatus | null>(null);

  useEffect(() => {
    fetch("/api/analytics/summary")
      .then((r) => r.json())
      .then(setKpi)
      .catch(() => {});

    fetch("/api/books")
      .then((r) => r.json())
      .then((d) => setBooks(d.books || []))
      .catch(() => {});

    fetch("/api/admin/storage")
      .then((r) => r.json())
      .then(setStorage)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-card dark:border-[#2C3733] dark:bg-[#1D2421]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="literary-text flex items-center gap-2 text-2xl font-bold text-[#173F35] dark:text-[#F3EFE7]">
              <BarChart3 size={22} className="text-[#B58B54]" />
              QAZINA Admin & Analytics (KPI)
            </h1>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
              Оқу қызығушылығын өлшеу метрикалары, квест QR сканерлеулері және 44 кітаптық қордың құқықтық мәртебесі.
            </p>
          </div>
          <span className="rounded-full bg-[#173F35] px-3 py-1 text-xs font-bold text-white">
            MVP 1.0 · Live Metrics
          </span>
        </div>

        {kpi && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#EFE8DD] bg-[#F8F5EF] p-4 dark:border-[#2C3733] dark:bg-[#141917]">
              <div className="text-xs font-semibold text-neutral-500">
                Fragment Completion Rate
              </div>
              <div className="mt-1 text-2xl font-extrabold text-[#173F35] dark:text-[#F3EFE7]">
                {kpi.fragment_completion_rate}%
              </div>
              <div className="mt-1 text-[11px] text-neutral-500">
                {kpi.fragments_completed} / {kpi.fragments_viewed} үзінді оқылды
              </div>
            </div>

            <div className="rounded-2xl border border-[#EFE8DD] bg-[#F8F5EF] p-4 dark:border-[#2C3733] dark:bg-[#141917]">
              <div className="text-xs font-semibold text-neutral-500">
                Reveal Rate («Ары қарай не болды?»)
              </div>
              <div className="mt-1 text-2xl font-extrabold text-[#B58B54]">
                {kpi.reveal_rate}%
              </div>
              <div className="mt-1 text-[11px] text-neutral-500">
                {kpi.reveals_clicked} рет кітап атауы ашылды
              </div>
            </div>

            <div className="rounded-2xl border border-[#EFE8DD] bg-[#F8F5EF] p-4 dark:border-[#2C3733] dark:bg-[#141917]">
              <div className="text-xs font-semibold text-neutral-500">
                Book Open Rate (Толық оқуға өту)
              </div>
              <div className="mt-1 text-2xl font-extrabold text-[#173F35] dark:text-[#F3EFE7]">
                {kpi.book_open_rate}%
              </div>
              <div className="mt-1 text-[11px] text-neutral-500">
                {kpi.books_opened} рет толық кітап ашылды
              </div>
            </div>

            <div className="rounded-2xl border border-[#EFE8DD] bg-[#F8F5EF] p-4 dark:border-[#2C3733] dark:bg-[#141917]">
              <div className="flex items-center gap-1 text-xs font-semibold text-neutral-500">
                <QrCode size={13} className="text-[#B58B54]" />
                Квест QR сканерлеу саны
              </div>
              <div className="mt-1 text-2xl font-extrabold text-[#173F35] dark:text-[#F3EFE7]">
                {kpi.quest_qr_scans}
              </div>
              <div className="mt-1 text-[11px] text-neutral-500">
                {kpi.quest_chapters_read} бөлім · {kpi.quest_completed} аяқталған квест
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-card dark:border-[#2C3733] dark:bg-[#1D2421]">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-[#173F35] dark:text-[#F3EFE7]">
          <Database size={18} className="text-[#B58B54]" />
          Alem Plus Supabase PostgreSQL & GitHub Hybrid Қоры
        </h2>
        {storage ? (
          <div className="grid gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-xl bg-[#F8F5EF] p-3 dark:bg-[#141917]">
              <div className="font-semibold text-neutral-500">Дерекқор күйі</div>
              <div className="mt-1 font-bold text-emerald-700 dark:text-emerald-300">
                {storage.connected ? "✓ Supabase PostgreSQL қосылған" : "Жергілікті JSON режимі"}
              </div>
            </div>
            <div className="rounded-xl bg-[#F8F5EF] p-3 dark:bg-[#141917]">
              <div className="font-semibold text-neutral-500">ДБ жазбалары</div>
              <div className="mt-1 font-bold text-[#173F35] dark:text-[#F3EFE7]">
                {storage.books_count} кітап · {storage.fragments_count} үзінді ({storage.drive_pdfs_count} Google Drive PDF)
              </div>
            </div>
            <div className="rounded-xl bg-[#F8F5EF] p-3 dark:bg-[#141917]">
              <div className="font-semibold text-neutral-500">MinIO Bucket</div>
              <div className="mt-1 truncate font-bold text-[#B58B54]">
                {storage.minio_bucket}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-500">Дерекқор күйі тексерілуде...</p>
        )}
      </section>

      <section className="rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-card dark:border-[#2C3733] dark:bg-[#1D2421]">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-[#173F35] dark:text-[#F3EFE7]">
          <Sparkles size={18} className="text-[#B58B54]" />
          AI Ranking Формуласы (Section 14.3)
        </h2>
        <code className="block overflow-x-auto rounded-xl bg-[#F8F5EF] p-3 text-xs font-semibold text-[#173F35] dark:bg-[#141917] dark:text-[#D4B382]">
          Score = 0.30*MoodMatch + 0.25*HookScore + 0.15*DialogueQuality + 0.15*EmotionalRelevance + 0.10*Readability + 0.05*ContextClarity
        </code>
      </section>

      <section className="rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-card dark:border-[#2C3733] dark:bg-[#1D2421]">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#173F35] dark:text-[#F3EFE7]">
          <ShieldCheck size={18} className="text-[#B58B54]" />
          44 кітаптық қор: Құқық және жас шектеуі аудиті
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#EFE8DD] text-neutral-500 dark:border-[#26302C]">
                <th className="py-2 pr-3">Кітап</th>
                <th className="py-2 pr-3">Автор</th>
                <th className="py-2 pr-3">Тіл</th>
                <th className="py-2 pr-3">Жас</th>
                <th className="py-2 pr-3">Тарау</th>
                <th className="py-2">Құқықтық мәртебе</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DD] dark:divide-[#26302C]">
              {books.map((b) => (
                <tr key={b.id}>
                  <td className="py-2 pr-3 font-semibold text-[#173F35] dark:text-[#F3EFE7]">
                    <Link href={`/books/${b.slug}`} className="hover:underline">
                      {b.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-neutral-600 dark:text-neutral-300">
                    {b.author}
                  </td>
                  <td className="py-2 pr-3 uppercase">{b.language}</td>
                  <td className="py-2 pr-3">{b.age_min}+</td>
                  <td className="py-2 pr-3">{b.total_chapters}</td>
                  <td className="py-2">
                    {b.rights_status === "review_required" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                        review_required
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <CheckCircle2 size={10} />
                        {b.rights_status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
