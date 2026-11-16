"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  BookOpen,
  Check,
  Heart,
  HelpCircle,
  ImagePlus,
  Loader2,
  RefreshCw,
  Share2,
  UserCheck,
} from "lucide-react";
import { useQazina } from "@/components/layout/QazinaProvider";
import { buildLLMHeaders } from "@/lib/clientStorage";
import type { HiddenFragmentPayload, RevealPayload } from "@/types/fragment";
import type { MoodAnalysisResult } from "@/types/recommendation";
import { SaveThoughtModal } from "./SaveThoughtModal";

interface FragmentCardProps {
  fragment: HiddenFragmentPayload;
  analysis?: MoodAnalysisResult;
  rawMoodText?: string;
  counterIndex?: number;
  onSkip: () => void;
  skipLoading?: boolean;
}

export function FragmentCard({
  fragment,
  analysis,
  rawMoodText = "",
  counterIndex = 1,
  onSkip,
  skipLoading = false,
}: FragmentCardProps) {
  const { copy, showToast } = useQazina();
  const [liked, setLiked] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedDone, setSavedDone] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [revealData, setRevealData] = useState<RevealPayload | null>(null);
  const [dilemmaChoice, setDilemmaChoice] = useState<string>("");
  const [dilemmaCustom, setDilemmaCustom] = useState("");
  const [dilemmaSubmitted, setDilemmaSubmitted] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);

  async function handleReveal() {
    if (revealing || revealData) return;
    setRevealing(true);
    try {
      const res = await fetch(
        `/api/fragments/${encodeURIComponent(fragment.fragment_id)}/reveal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...buildLLMHeaders(),
          },
          body: JSON.stringify({ mood_text: rawMoodText }),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as RevealPayload;
        setRevealData(data);
        void fetch("/api/analytics/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "fragment_complete" }),
        });
      } else {
        showToast("Кітап деректерін ашу мүмкін болмады");
      }
    } catch {
      showToast("Желі қатесі орын алды");
    } finally {
      setRevealing(false);
    }
  }

  async function handleGenerateIllustration() {
    if (imageBusy || !revealData) return;
    setImageBusy(true);
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: revealData.book_title,
          text: fragment.text,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.image_url) {
        setSceneImage(data.image_url);
      } else {
        showToast(data?.error || "Сурет салу мүмкін болмады");
      }
    } catch {
      showToast("Сурет генерациясы сәтсіз болды");
    } finally {
      setImageBusy(false);
    }
  }

  async function handleShare() {
    const shareText = revealData
      ? `«${fragment.text}»\n— ${revealData.book_title}, ${revealData.author} (QAZINA)`
      : `«${fragment.text}» — QAZINA үзіндісі`;

    try {
      if (navigator.share) {
        await navigator.share({ title: "QAZINA үзіндісі", text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        showToast("Үзінді көшірілді");
      }
    } catch {
      // user cancelled share
    }
  }

  function submitDilemma(choice: string) {
    setDilemmaChoice(choice);
    setDilemmaSubmitted(true);
    void fetch("/api/analytics/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "dilemma" }),
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-extrabold text-[#253b30] dark:text-[#F3EFE7]">
        <span>Саған арналған үзінді</span>
        <span className="text-[11px] font-bold text-[#6d9a79]">
          ● {counterIndex}-үзінді
        </span>
      </div>

      <article className="rounded-3xl border border-[#e9ebe2] bg-[#fffefa] p-5 shadow-literary transition dark:border-[#2C3733] dark:bg-[#1D2421] sm:p-6">
        {/* Card Person Header matching offline-demo.html */}
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8f0e5] text-lg font-bold text-[#477859] dark:bg-[#26302C] dark:text-[#D4B382]">
            ✺
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-extrabold text-[#253b30] dark:text-[#F3EFE7]">
              QAZINA ✦
            </div>
            <div className="truncate text-[11px] text-[#89958b]">
              {revealData
                ? `${revealData.book_title} · ${revealData.author}`
                : "Әдеби сәт · дереккөз жасырын"}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowFormula((v) => !v)}
            className="rounded-full border border-[#e1e6df] px-2.5 py-1 text-[10px] font-bold text-[#457359] hover:border-[#B58B54] dark:border-[#2C3733] dark:text-[#D4B382]"
          >
            {(fragment.ranking_score * 100).toFixed(0)}% · {fragment.engine_mode === "cloud-llm" ? "Cloud AI" : "MVP"}
          </button>
        </div>

        {analysis && (
          <p className="mb-4 rounded-xl bg-[#f5f5ef] px-3 py-2 text-xs text-[#4a5c50] dark:bg-[#141917] dark:text-neutral-300">
            {analysis.summary_kk}
          </p>
        )}

        {showFormula && (
          <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl border border-[#e1e6df] bg-[#f5f5ef] p-3 text-[11px] dark:border-[#2C3733] dark:bg-[#141917] sm:grid-cols-3">
            <div>MoodMatch (30%): {(fragment.score_breakdown.mood_match * 100).toFixed(0)}%</div>
            <div>HookScore (25%): {(fragment.score_breakdown.hook_score * 100).toFixed(0)}%</div>
            <div>Dialogue (15%): {(fragment.score_breakdown.dialogue_quality * 100).toFixed(0)}%</div>
            <div>Emotion (15%): {(fragment.score_breakdown.emotional_relevance * 100).toFixed(0)}%</div>
            <div>Readability (10%): {(fragment.score_breakdown.readability * 100).toFixed(0)}%</div>
            <div>Clarity (5%): {(fragment.score_breakdown.context_clarity * 100).toFixed(0)}%</div>
          </div>
        )}

        {/* Literary Verbatim Fragment */}
        <div className="literary-text min-h-[160px] space-y-2.5 text-[18px] leading-[1.7] text-[#253b30] dark:text-[#F3EFE7] sm:text-[19px]">
          {fragment.text.split("\n").map((line, i) =>
            line.trim() === "" ? (
              <div key={i} className="h-2" />
            ) : (
              <p key={i}>{line}</p>
            ),
          )}
        </div>

        {/* Optional Dilemma («Сен оның орнында болсаң?») */}
        {fragment.dilemma && (
          <div className="mt-5 rounded-2xl border border-[#e1e6dc] bg-[#f8f5ef] p-4 dark:border-[#2C3733] dark:bg-[#141917]">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#376d55] dark:text-[#D4B382]">
              <HelpCircle size={13} className="text-[#B58B54]" />
              {copy.fragment.dilemmaTitle}
            </p>
            <p className="mb-2.5 text-xs font-semibold text-[#253b30] dark:text-[#F3EFE7]">
              {fragment.dilemma.question}
            </p>
            {!dilemmaSubmitted ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {fragment.dilemma.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => submitDilemma(opt)}
                      className="rounded-lg border border-[#d2e1d5] bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-[#253b30] hover:border-[#376d55] dark:border-[#2C3733] dark:bg-[#1D2421] dark:text-[#F3EFE7]"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={dilemmaCustom}
                    onChange={(e) => setDilemmaCustom(e.target.value)}
                    placeholder="Өз ойыңды жаз..."
                    className="flex-1 rounded-lg border border-[#e2e8dd] bg-white px-2.5 py-1 text-xs outline-none dark:border-[#2C3733] dark:bg-[#1D2421]"
                  />
                  {dilemmaCustom.trim() && (
                    <button
                      type="button"
                      onClick={() => submitDilemma(dilemmaCustom.trim())}
                      className="rounded-lg bg-[#2f6a50] px-2.5 py-1 text-xs font-bold text-white"
                    >
                      ОК
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-white p-2.5 text-xs text-[#376d55] dark:bg-[#1D2421] dark:text-[#D4B382]">
                Таңдауың: «{dilemmaChoice}»
              </p>
            )}
          </div>
        )}

        {/* Icon Bar matching offline-demo.html */}
        <div className="mt-5 flex items-center gap-4 border-t border-[#e9ede5] pt-3.5 dark:border-[#26302C]">
          <button
            type="button"
            onClick={() => setLiked((v) => !v)}
            title="Ұнады"
            className={`inline-flex items-center gap-1 text-sm font-semibold transition ${
              liked ? "text-[#c06a6a]" : "text-[#8b9a8b] hover:text-[#253b30]"
            }`}
          >
            <Heart size={18} className={liked ? "fill-[#c06a6a]" : ""} />
            <span className="text-xs">Ұнады</span>
          </button>

          <button
            type="button"
            onClick={() => void handleShare()}
            title="Көшіру"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#8b9a8b] transition hover:text-[#253b30]"
          >
            <Share2 size={17} />
            <span className="text-xs">Бөлісу</span>
          </button>

          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            title="Сақтау"
            className={`ml-auto inline-flex items-center gap-1 text-sm font-semibold transition ${
              savedDone
                ? "text-[#2f6a50] dark:text-[#D4B382]"
                : "text-[#8b9a8b] hover:text-[#253b30]"
            }`}
          >
            {savedDone ? <Check size={17} /> : <Bookmark size={17} />}
            <span className="text-xs">{savedDone ? "Сақталды" : "Ой сақтау"}</span>
          </button>
        </div>

        {/* Soft-Green Reveal Box matching offline-demo.html */}
        {!revealData ? (
          <div className="mt-4 rounded-2xl border border-[#d9e9d7] bg-[#edf4e9] p-4 dark:border-[#2C3733] dark:bg-[#141917]">
            <div className="text-[10px] font-extrabold uppercase tracking-[1.5px] text-[#568b66] dark:text-[#D4B382]">
              ✧ ҚЫЗЫҚТЫ МА?
            </div>
            <h3 className="mt-2 text-lg font-bold text-[#253b30] dark:text-[#F3EFE7]">
              Одан кейін не болды?
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[#738575] dark:text-neutral-300">
              Жалғасын оқуға шешім қабылдағанда ғана кітаптың аты мен авторы ашылады.
            </p>
            <button
              type="button"
              onClick={() => void handleReveal()}
              disabled={revealing}
              className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2f6a50] px-4 py-3 text-xs font-extrabold text-white transition hover:bg-[#245941] disabled:opacity-60"
            >
              {revealing && <Loader2 size={15} className="animate-spin" />}
              Жалғасын білгім келеді →
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4 border-t border-[#e9ede5] pt-5 dark:border-[#26302C]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#2f6a50] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  {revealData.language.toUpperCase()}
                </span>
                <span className="text-[11px] font-semibold text-[#829184]">
                  {revealData.rights_note}
                </span>
              </div>
              <h2 className="literary-text mt-1.5 text-2xl font-bold text-[#253b30] dark:text-[#F3EFE7]">
                {revealData.book_title}
              </h2>
              <p className="text-xs font-bold text-[#B58B54]">
                {revealData.author} · {revealData.chapter_title}
              </p>
            </div>

            {/* Inline continuation matching offline-demo.html */}
            {revealData.continuation_preview &&
              revealData.continuation_preview.length > 0 && (
                <div className="literary-text space-y-2.5 text-[17px] leading-[1.8] text-[#242424] dark:text-[#F3EFE7]">
                  {revealData.continuation_preview.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              )}

            {/* Character Match */}
            <div className="rounded-xl bg-[#edf4e9] p-3 text-xs dark:bg-[#141917]">
              <div className="mb-1 flex items-center gap-1.5 font-bold text-[#2f6a50] dark:text-[#D4B382]">
                <UserCheck size={14} />
                {copy.fragment.characterMatch}: {revealData.character_match.character_name}
              </div>
              <p className="text-[#456f52] dark:text-neutral-300">
                {revealData.character_match.explanation}
              </p>
            </div>

            {sceneImage && (
              <div className="overflow-hidden rounded-2xl border border-[#e1e6df]">
                <img
                  src={sceneImage}
                  alt={revealData.book_title}
                  className="h-52 w-full object-cover"
                />
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={revealData.reader_url}
                onClick={() => {
                  void fetch("/api/analytics/summary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ event: "book_open" }),
                  });
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2f6a50] px-4 py-3 text-xs font-extrabold text-white transition hover:bg-[#245941]"
              >
                <BookOpen size={15} />
                Толық кітапты ридерде оқу →
              </Link>

              <button
                type="button"
                onClick={() => void handleGenerateIllustration()}
                disabled={imageBusy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#d2e1d5] bg-white px-3.5 py-2.5 text-xs font-bold text-[#32654b] hover:bg-[#f5f5ef] disabled:opacity-60 dark:border-[#2C3733] dark:bg-[#141917] dark:text-[#D4B382]"
              >
                {imageBusy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ImagePlus size={14} />
                )}
                {imageBusy ? "Салынуда..." : "Иллюстрация (AI)"}
              </button>
            </div>
          </div>
        )}
      </article>

      {/* Bottom Ghost Action Row matching offline-demo.html */}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onSkip}
          disabled={skipLoading}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#d2e1d5] bg-white px-4 py-3 text-xs font-extrabold text-[#32654b] transition hover:bg-[#edf4e9] disabled:opacity-60 dark:border-[#2C3733] dark:bg-[#1D2421] dark:text-[#D4B382]"
        >
          <RefreshCw size={14} className={skipLoading ? "animate-spin" : ""} />
          ↻ Басқа үзінді
        </button>

        <button
          type="button"
          onClick={() => setSaveOpen(true)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#d2e1d5] bg-white px-4 py-3 text-xs font-extrabold text-[#32654b] transition hover:bg-[#edf4e9] dark:border-[#2C3733] dark:bg-[#1D2421] dark:text-[#D4B382]"
        >
          <Bookmark size={14} />
          {savedDone ? "✓ Сақталды" : "♧ Сақтау"}
        </button>
      </div>

      <SaveThoughtModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        fragmentId={fragment.fragment_id}
        text={fragment.text}
        revealed={Boolean(revealData)}
        bookSlug={revealData?.book_slug}
        bookTitle={revealData?.book_title}
        author={revealData?.author}
        chapterId={revealData?.chapter_id}
        onSaved={() => {
          setSavedDone(true);
          showToast("Үзінді «Сақталған» жинағына қосылды");
        }}
      />
    </div>
  );
}
