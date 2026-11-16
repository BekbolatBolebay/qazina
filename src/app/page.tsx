"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, KeySquare } from "lucide-react";
import { FragmentCard } from "@/components/fragments/FragmentCard";
import { useQazina } from "@/components/layout/QazinaProvider";
import { MoodInput } from "@/components/mood/MoodInput";
import { buildLLMHeaders } from "@/lib/clientStorage";
import type { RecommendationResponse } from "@/types/recommendation";

const INITIAL_DEMO_FRAGMENT: RecommendationResponse = {
  analysis: {
    emotion: "шаршау",
    emotion_en: "fatigue",
    topics: ["диалог", "өмір"],
    reader_intent: "тыныштық",
    language: "kk",
    summary_kk: "Күнделікті күйбеңнен кейінгі жылу мен үміт іздеу сәті.",
    safety_alert: false,
    engine: "offline-mvp",
  },
  fragment: {
    fragment_id: "frag_orig_window",
    text: "— Неге әр кеш сайын осы терезеге қарайсың?\n— Өйткені онда үнемі жарық жанып тұрады.\n— Ол үйде кім тұрады?\n— Білмеймін. Бірақ біреудің мені күтіп отырғанын елестеткен ұнайды.",
    type: "dialogue",
    language: "kk",
    dialogue_category: "достық",
    moods: ["шаршау", "мұң", "жалғыздық"],
    topics: ["диалог", "өмір"],
    revealed: false,
    ranking_score: 0.96,
    score_breakdown: {
      mood_match: 0.92,
      hook_score: 0.94,
      dialogue_quality: 0.98,
      emotional_relevance: 0.95,
      readability: 0.99,
      context_clarity: 0.97,
    },
    dilemma: {
      question:
        "Күн сайын саған үміт сыйлайтын терезенің жарығы бір кеште өшіп қалса, есікті қағар ма едің?",
      options: [
        "Иә, батылданып есікті қағамын",
        "Алыстан бақылап, себебін түсінуге тырысамын",
      ],
    },
    actions: ["like", "save", "share", "reveal", "skip"],
    engine_mode: "cloud-llm",
    engine_model: "qwen3-8 + reranker",
  },
  remaining_candidates: 28,
};

export default function HomePage() {
  const { profile, llmStatus } = useQazina();
  const [result, setResult] = useState<RecommendationResponse>(INITIAL_DEMO_FRAGMENT);
  const [rawMood, setRawMood] = useState("Бүгін сәл шаршадым");
  const [seenIds, setSeenIds] = useState<string[]>(["frag_orig_window"]);
  const [skipping, setSkipping] = useState(false);

  // Also refresh live status indicator cleanly
  useEffect(() => {
    setResult((prev) => {
      if (!prev.fragment) return prev;
      return {
        ...prev,
        fragment: {
          ...prev.fragment,
          engine_mode: llmStatus.reachable ? "cloud-llm" : "offline-mvp",
          engine_model: llmStatus.reachable ? `${llmStatus.model} + reranker` : undefined,
        },
      };
    });
  }, [llmStatus.reachable, llmStatus.model]);

  function handleResult(res: RecommendationResponse, moodText: string) {
    setResult(res);
    setRawMood(moodText);
    if (res.fragment) {
      setSeenIds([res.fragment.fragment_id]);
    }
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      const el = document.getElementById("fragment-stage");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function handleSkip() {
    setSkipping(true);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildLLMHeaders(),
        },
        body: JSON.stringify({
          mood_text: rawMood,
          analysis: result.analysis,
          age_group: profile.age_group,
          exclude_ids: seenIds,
          prefer_dialogue: true,
        }),
      });
      if (res.ok) {
        const next = (await res.json()) as RecommendationResponse;
        setResult(next);
        if (next.fragment) {
          setSeenIds((prev) => [...prev, next.fragment!.fragment_id]);
        }
      }
    } finally {
      setSkipping(false);
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
      {/* Left Column: Hero + Mood Input matching offline-demo.html */}
      <section className="space-y-6">
        <div className="space-y-3">
          <div className="text-[11px] font-extrabold uppercase tracking-[2px] text-[#376d55] dark:text-[#D4B382]">
            ✦ Кітап оқудың жаңа тәсілі
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-[#253b30] dark:text-[#F3EFE7] sm:text-5xl">
            Әр сезімнің{" "}
            <span className="block text-[#376d55] dark:text-[#D4B382]">
              өз оқиғасы бар.
            </span>
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-[#6b766c] dark:text-neutral-300">
            Қалай сезініп отырсың? Жай ғана жаз, дауыспен айт немесе кітап бетін суретке түсір.
            Саған қызықты әдеби диалог көрсетеміз. Ал кітаптың атын тек өзің қызыққан кезде ашамыз.
          </p>
        </div>

        <MoodInput onResult={handleResult} />

        <div className="flex flex-wrap items-center gap-2.5 text-xs font-medium text-[#7f8b80] dark:text-neutral-400">
          <b className="text-[#457359] dark:text-[#D4B382]">01 Сезіміңді бөліс</b>
          <span>•</span>
          <b className="text-[#457359] dark:text-[#D4B382]">02 Үзіндіні оқы</b>
          <span>•</span>
          <b className="text-[#457359] dark:text-[#D4B382]">03 Кітапты аш</b>
        </div>

        {/* Compact Quest Card */}
        <section className="rounded-2xl border border-[#B58B54]/35 bg-[#173F35] p-5 text-[#F8F5EF] shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#D4B382]">
                <KeySquare size={13} />
                Интерактивті кампус квесті · 16 бөлім
              </span>
              <h2 className="literary-text text-lg font-bold">
                Жатақхана құпиясы
              </h2>
              <p className="text-xs text-[#EFE8DD]/85">
                7 жасырын үзінді, QR-код парақшалары және оқиға ретін құрастыру пазлы.
              </p>
            </div>
            <Link
              href="/quest"
              className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#B58B54] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#9E7642] sm:w-auto"
            >
              Квестке кіру
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </section>

      {/* Right Column: Always-Visible Live Fragment Card matching offline-demo.html */}
      <section id="fragment-stage" className="scroll-mt-24">
        {result.fragment && (
          <FragmentCard
            key={result.fragment.fragment_id}
            fragment={result.fragment}
            analysis={result.analysis}
            rawMoodText={rawMood}
            counterIndex={seenIds.length}
            onSkip={handleSkip}
            skipLoading={skipping}
          />
        )}
      </section>
    </div>
  );
}
