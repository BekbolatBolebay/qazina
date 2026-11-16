"use client";

import React, { useEffect, useState } from "react";
import { FragmentCard } from "@/components/fragments/FragmentCard";
import { useQazina } from "@/components/layout/QazinaProvider";
import { MoodInput } from "@/components/mood/MoodInput";
import { buildLLMHeaders } from "@/lib/clientStorage";
import type { RecommendationResponse } from "@/types/recommendation";

export default function DiscoverPage() {
  const { profile } = useQazina();
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [rawMood, setRawMood] = useState("");
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchRecommendation(
    mood = "шытырман мен терең диалог іздеймін",
    exclude: string[] = [],
  ) {
    setLoading(true);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildLLMHeaders(),
        },
        body: JSON.stringify({
          mood_text: mood,
          age_group: profile.age_group,
          exclude_ids: exclude,
          prefer_dialogue: true,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as RecommendationResponse;
        setResult(data);
        setRawMood(mood);
        if (data.fragment) {
          setSeenIds([...exclude, data.fragment.fragment_id]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRecommendation();
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <MoodInput
        compact
        onResult={(res, text) => {
          setResult(res);
          setRawMood(text);
          if (res.fragment) setSeenIds([res.fragment.fragment_id]);
        }}
      />

      {result?.fragment && (
        <FragmentCard
          key={result.fragment.fragment_id}
          fragment={result.fragment}
          analysis={result.analysis}
          rawMoodText={rawMood}
          onSkip={() => void fetchRecommendation(rawMood, seenIds)}
          skipLoading={loading}
        />
      )}
    </div>
  );
}
