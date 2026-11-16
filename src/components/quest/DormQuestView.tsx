"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  KeySquare,
  MapPin,
  Printer,
  QrCode,
  Sparkles,
  Unlock,
} from "lucide-react";
import { useQazina } from "@/components/layout/QazinaProvider";
import { loadQuestState, saveQuestState } from "@/lib/clientStorage";
import type { DormQuestData, QuestClue } from "@/types/quest";
import { QrSvg } from "./QrSvg";

type QuestTab = "story" | "puzzle" | "print";

const INITIAL_SHUFFLED_IDS = [
  "clue-3",
  "clue-1",
  "clue-6",
  "clue-2",
  "clue-5",
  "clue-7",
  "clue-4",
];

export function DormQuestView({ quest }: { quest: DormQuestData }) {
  const { showToast } = useQazina();
  const [tab, setTab] = useState<QuestTab>("story");
  const [unlockedCount, setUnlockedCount] = useState(1);
  const [foundClues, setFoundClues] = useState<string[]>([]);
  const [puzzleOrder, setPuzzleOrder] = useState<string[]>(INITIAL_SHUFFLED_IDS);
  const [puzzleSolved, setPuzzleSolved] = useState(false);

  const clueMap = new Map<string, QuestClue>(quest.clues.map((c) => [c.id, c]));
  const correctOrder = quest.clues
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((c) => c.id);

  useEffect(() => {
    const saved = loadQuestState(INITIAL_SHUFFLED_IDS);
    setUnlockedCount(saved.unlockedChapters);
    setFoundClues(saved.foundClues);
    setPuzzleOrder(saved.puzzleOrder);
    setPuzzleSolved(saved.puzzleSolved);
  }, []);

  function persist(patch: {
    unlockedChapters?: number;
    foundClues?: string[];
    puzzleOrder?: string[];
    puzzleSolved?: boolean;
  }) {
    const next = {
      unlockedChapters: patch.unlockedChapters ?? unlockedCount,
      foundClues: patch.foundClues ?? foundClues,
      puzzleOrder: patch.puzzleOrder ?? puzzleOrder,
      puzzleSolved: patch.puzzleSolved ?? puzzleSolved,
    };
    saveQuestState(next);
  }

  function unlockNextChapter() {
    const nextCount = Math.min(quest.chapters.length, unlockedCount + 1);
    setUnlockedCount(nextCount);
    persist({ unlockedChapters: nextCount });
    void fetch("/api/quest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "chapter_read" }),
    });
  }

  function unlockAllChapters() {
    setUnlockedCount(quest.chapters.length);
    persist({ unlockedChapters: quest.chapters.length });
  }

  function moveClue(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= puzzleOrder.length) return;
    const copy = puzzleOrder.slice();
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    setPuzzleOrder(copy);
    const isNowSolved = copy.every((id, idx) => id === correctOrder[idx]);
    if (isNowSolved && !puzzleSolved) {
      setPuzzleSolved(true);
      persist({ puzzleOrder: copy, puzzleSolved: true });
      showToast("Құттықтаймыз! Оқиға желісі толық шешілді!");
      void fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quest_complete" }),
      });
    } else {
      persist({ puzzleOrder: copy });
    }
  }

  function downloadGoogleDoc() {
    const html = `<!DOCTYPE html>
<html lang="kk">
<head>
<meta charset="utf-8" />
<title>${quest.title}</title>
<style>
  body { font-family: Georgia, serif; line-height: 1.6; max-width: 760px; margin: 40px auto; color: #222; }
  h1 { color: #173F35; }
  h2 { color: #B58B54; margin-top: 28px; }
  .hook { font-weight: bold; color: #173F35; margin-top: 10px; }
  .clue { border: 1px dashed #173F35; padding: 14px; margin: 16px 0; background: #F8F5EF; }
</style>
</head>
<body>
  <h1>${quest.title}</h1>
  <p><strong>Жанр:</strong> ${quest.genre.join(", ")} | <strong>Аудитория:</strong> ${quest.target_audience}</p>
  <hr/>
  ${quest.chapters
    .map(
      (ch) => `
    <h2>${ch.title}</h2>
    <p><em>${ch.location_hint} · ${ch.time_label}</em></p>
    ${ch.text
      .split("\n")
      .map((line) => (line.trim() ? `<p>${line}</p>` : ""))
      .join("")}
    <p class="hook">${ch.ending_hook}</p>
  `,
    )
    .join("")}
  <hr/>
  <h1>Қабырғалар мен парталарға арналған 7 үзінді (QR-квест)</h1>
  ${quest.clues
    .map(
      (c) => `
    <div class="clue">
      <h3>${c.title} — ${c.location_name}</h3>
      <p><small>${c.location_detail}</small></p>
      <p>${c.excerpt.replace(/\n/g, "<br/>")}</p>
      <p><strong>${c.intrigue_line}</strong></p>
      <p><em>QR сілтемесі: ${c.qr_path}</em></p>
    </div>
  `,
    )
    .join("")}
</body>
</html>`;

    const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Dalee_Zhatakhana_Qupiyasy_GoogleDocs.doc";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Google Docs / Word (.doc) файлы жүктелді");
  }

  function downloadMarkdown() {
    const md = [
      `# ${quest.title}`,
      `_${quest.subtitle}_`,
      "",
      ...quest.chapters.flatMap((ch) => [
        `## ${ch.title}`,
        `> ${ch.location_hint} (${ch.time_label})`,
        "",
        ch.text,
        "",
        `**${ch.ending_hook}**`,
        "",
        "---",
        "",
      ]),
      "# 7 QR Үзінді (Кампус квесті)",
      "",
      ...quest.clues.flatMap((c) => [
        `### ${c.title} — ${c.location_name}`,
        `Орны: ${c.location_detail}`,
        "",
        c.excerpt,
        "",
        `**${c.intrigue_line}** (QR: ${c.qr_path})`,
        "",
      ]),
    ].join("\n");

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Dalee_Zhatakhana_Qupiyasy.md";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Markdown (.md) файлы жүктелді");
  }

  async function copyTelegramPosts() {
    const tgText = quest.chapters
      .map(
        (ch) =>
          `📌 ${ch.title}\n📍 ${ch.location_hint} · 🕒 ${ch.time_label}\n\n${ch.text}\n\n👉 ${ch.ending_hook}`,
      )
      .join("\n\n━━━━━━━━━━━━━━\n\n");
    await navigator.clipboard.writeText(tgText);
    showToast("16 Telegram / Threads посты алмасу буферіне көшірілді");
  }

  const visibleChapters = quest.chapters.slice(0, unlockedCount);
  const exactMatches = puzzleOrder.filter((id, idx) => id === correctOrder[idx]).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header Hero */}
      <section className="no-print rounded-3xl border border-[#B58B54]/40 bg-[#173F35] p-6 text-[#F8F5EF] shadow-literary sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#B58B54]/25 px-3 py-1 text-xs font-bold text-[#D4B382]">
              <KeySquare size={14} />
              Интерактивті Storytelling-Квест · MVP
            </span>
            <h1 className="literary-text text-2xl font-bold sm:text-3xl">
              {quest.title}
            </h1>
            <p className="max-w-2xl text-sm text-[#EFE8DD]/90">
              {quest.subtitle} · Жанры: {quest.genre.join(", ")} · Көлемі:{" "}
              {quest.chapters.length} бөлім (~{quest.total_words} сөз)
            </p>
          </div>

          <Link
            href={`/read/${quest.slug}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#B58B54] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#9E7642]"
          >
            <BookOpen size={15} />
            Қалыпты ридерде оқу
          </Link>
        </div>

        {/* Navigation Tabs */}
        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
          <button
            type="button"
            onClick={() => setTab("story")}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              tab === "story"
                ? "bg-[#F8F5EF] text-[#173F35]"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Sparkles size={14} />
            Оқиға желісі ({unlockedCount}/{quest.chapters.length})
          </button>

          <button
            type="button"
            onClick={() => setTab("puzzle")}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              tab === "puzzle"
                ? "bg-[#F8F5EF] text-[#173F35]"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Unlock size={14} />
            Квест-пазл (Ретін тап · {exactMatches}/7)
          </button>

          <button
            type="button"
            onClick={() => setTab("print")}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              tab === "print"
                ? "bg-[#F8F5EF] text-[#173F35]"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <QrCode size={14} />
            7 QR Қағаз & Экспорт
          </button>
        </div>
      </section>

      {/* TAB 1: Threads / Telegram Stories Style 16-Chapter Interactive Reader */}
      {tab === "story" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-300">
            <span>
              Стилі: бірінші жақтан · Threads / Telegram Stories форматы · диалог + интрига
            </span>
            {unlockedCount < quest.chapters.length && (
              <button
                type="button"
                onClick={unlockAllChapters}
                className="font-semibold text-[#173F35] underline hover:text-[#B58B54] dark:text-[#D4B382]"
              >
                Барлық 16 бөлімді ашу
              </button>
            )}
          </div>

          {visibleChapters.map((ch, idx) => {
            const isLatest = idx === visibleChapters.length - 1;
            return (
              <article
                key={ch.id}
                className="rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-card dark:border-[#2C3733] dark:bg-[#1D2421] sm:p-7"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#EFE8DD] pb-3 dark:border-[#26302C]">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#B58B54]">
                      {ch.time_label} · {ch.location_hint}
                    </span>
                    <h2 className="literary-text text-lg font-bold text-[#173F35] dark:text-[#F3EFE7]">
                      {ch.title}
                    </h2>
                  </div>
                  <span className="rounded-full bg-[#EFE8DD] px-2.5 py-0.5 text-[11px] font-semibold text-[#173F35] dark:bg-[#26302C] dark:text-[#D4B382]">
                    ~{ch.word_count} сөз
                  </span>
                </div>

                <div className="literary-text space-y-2.5 text-[16px] leading-relaxed text-[#242424] dark:text-[#F3EFE7]">
                  {ch.text.split("\n").map((line, i) =>
                    line.trim() === "" ? (
                      <div key={i} className="h-2" />
                    ) : (
                      <p
                        key={i}
                        className={
                          line.trim().startsWith("—")
                            ? "border-l-2 border-[#B58B54]/60 pl-3 font-medium"
                            : ""
                        }
                      >
                        {line}
                      </p>
                    ),
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#EFE8DD] pt-4 dark:border-[#26302C]">
                  {ch.is_final ? (
                    <div className="flex w-full flex-col items-start justify-between gap-4 rounded-2xl bg-[#173F35] p-5 text-[#F8F5EF] sm:flex-row sm:items-center">
                      <div className="space-y-1.5">
                        <div className="text-sm font-bold text-[#D4B382]">
                          {ch.ending_hook}
                        </div>
                        <p className="text-xs text-[#EFE8DD]">
                          Оқиға осымен аяқталған жоқ... Оқуды жалғастыру немесе басқа үзінді ашу үшін QR-кодты сканерле немесе батырманы бас.
                        </p>
                        <div className="pt-2">
                          <Link
                            href="/discover"
                            className="inline-flex items-center gap-2 rounded-xl bg-[#B58B54] px-4 py-2 text-xs font-bold text-white hover:bg-[#9E7642]"
                          >
                            QAZINA платформасына өту
                            <ArrowRight size={14} />
                          </Link>
                        </div>
                      </div>
                      <QrSvg path={`/read/${quest.slug}`} size={108} label="Толық нұсқа QR" />
                    </div>
                  ) : isLatest && unlockedCount < quest.chapters.length ? (
                    <button
                      type="button"
                      onClick={unlockNextChapter}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#173F35] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#112F28] sm:w-auto sm:py-2.5"
                    >
                      Ары қарай не болды? (Келесі бөлім) →
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-neutral-400">
                      {ch.number}-бөлім оқылды
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* TAB 2: Interactive Story Order Puzzle */}
      {tab === "puzzle" && (
        <section className="space-y-4 rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-card dark:border-[#2C3733] dark:bg-[#1D2421]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="literary-text text-xl font-bold text-[#173F35] dark:text-[#F3EFE7]">
                Кампус үзінділерінің хронологиясын құрастыр
              </h2>
              <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                Жатақхана мен оқу ғимаратынан табылған 7 үзіндіні оқиға ретімен орналастырып,
                404-бөлменің құпия кодын аш.
              </p>
            </div>
            <div className="rounded-xl bg-[#EFE8DD] px-3 py-1.5 text-xs font-bold text-[#173F35] dark:bg-[#26302C] dark:text-[#D4B382]">
              Дұрыс орын: {exactMatches} / {quest.clues.length}
            </div>
          </div>

          {puzzleSolved && (
            <div className="rounded-2xl border-2 border-emerald-600/40 bg-emerald-50 p-5 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
              <div className="mb-1 flex items-center gap-2 font-bold">
                <CheckCircle2 size={18} className="text-emerald-600" />
                Құпия ашылды!
              </div>
              <p className="leading-relaxed">{quest.secret_archive_unlock}</p>
            </div>
          )}

          <ol className="space-y-2.5">
            {puzzleOrder.map((id, idx) => {
              const clue = clueMap.get(id);
              if (!clue) return null;
              const isCorrect = correctOrder[idx] === id;
              const isScanned = foundClues.includes(id);

              return (
                <li
                  key={id}
                  className={`flex items-start justify-between gap-3 rounded-2xl border p-4 transition ${
                    isCorrect
                      ? "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20"
                      : "border-[#EFE8DD] bg-[#F8F5EF] dark:border-[#2C3733] dark:bg-[#141917]"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#173F35] text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-[#173F35] dark:text-[#F3EFE7]">
                        {clue.location_name}
                      </span>
                      {isScanned && (
                        <span className="rounded bg-[#B58B54] px-2 py-0.5 text-[10px] font-bold text-white">
                          QR сканерленген
                        </span>
                      )}
                    </div>
                    <p className="literary-text text-sm text-neutral-700 dark:text-neutral-300">
                      {clue.excerpt}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveClue(idx, -1)}
                      aria-label="Жоғары жылжыту"
                      className="rounded-lg border border-[#EFE8DD] bg-white p-1.5 hover:bg-[#EFE8DD] disabled:opacity-30 dark:border-[#2C3733] dark:bg-[#1D2421]"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === puzzleOrder.length - 1}
                      onClick={() => moveClue(idx, 1)}
                      aria-label="Төмен жылжыту"
                      className="rounded-lg border border-[#EFE8DD] bg-white p-1.5 hover:bg-[#EFE8DD] disabled:opacity-30 dark:border-[#2C3733] dark:bg-[#1D2421]"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* TAB 3: 7 Printable Campus QR Clue Sheets + Exports */}
      {tab === "print" && (
        <div className="space-y-5">
          <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EFE8DD] bg-white p-4 dark:border-[#2C3733] dark:bg-[#1D2421]">
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              Партаға, жатақхана қабырғасына, асханаға, демалыс аймағына, кітапханаға және хабарландыру тақтасына ілуге дайын 7 парақша:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#173F35] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#112F28]"
              >
                <Printer size={14} />
                Басып шығару / PDF
              </button>
              <button
                type="button"
                onClick={downloadGoogleDoc}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3.5 py-2 text-xs font-bold text-[#173F35] hover:border-[#B58B54]"
              >
                <FileText size={14} />
                Google Docs (.doc)
              </button>
              <button
                type="button"
                onClick={downloadMarkdown}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3.5 py-2 text-xs font-bold text-[#173F35] hover:border-[#B58B54]"
              >
                <Download size={14} />
                Markdown (.md)
              </button>
              <button
                type="button"
                onClick={() => void copyTelegramPosts()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3.5 py-2 text-xs font-bold text-[#173F35] hover:border-[#B58B54]"
              >
                <Copy size={14} />
                Telegram посттарды көшіру
              </button>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {quest.clues.map((clue) => (
              <div
                key={clue.id}
                className="print-break-inside-avoid flex flex-col justify-between gap-4 rounded-3xl border-2 border-dashed border-[#173F35]/40 bg-white p-6 shadow-sm dark:border-[#B58B54]/40 dark:bg-[#1D2421]"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#173F35] px-3 py-1 text-[11px] font-bold text-white">
                      <MapPin size={12} />
                      {clue.location_name}
                    </span>
                    <span className="text-xs font-bold text-[#B58B54]">
                      #{clue.order_index} / 7
                    </span>
                  </div>

                  <p className="no-print text-[11px] text-neutral-500">
                    Орналастыру орны: {clue.location_detail}
                  </p>

                  <h3 className="text-sm font-bold text-[#173F35] dark:text-[#D4B382]">
                    {clue.title}
                  </h3>

                  <div className="literary-text space-y-2 rounded-2xl bg-[#F8F5EF] p-4 text-[15px] leading-relaxed text-[#242424] dark:bg-[#141917] dark:text-[#F3EFE7]">
                    {clue.excerpt.split("\n").map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                    <p className="pt-1 font-sans text-sm font-extrabold text-[#173F35] dark:text-[#D4B382]">
                      {clue.intrigue_line}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-[#EFE8DD] pt-4 dark:border-[#26302C]">
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-[#173F35] dark:text-[#F3EFE7]">
                      Жатақхана құпиясы · QAZINA
                    </div>
                    <p className="text-[11px] text-neutral-500">
                      Жалғасын немесе толық нұсқасын ашу үшін QR-кодты сканерле
                    </p>
                    <Link
                      href={clue.qr_path}
                      className="no-print inline-flex items-center gap-1 font-semibold text-[#B58B54] underline"
                    >
                      QR бетін ашып тексеру →
                    </Link>
                  </div>

                  <QrSvg path={clue.qr_path} size={96} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
