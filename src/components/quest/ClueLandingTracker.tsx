"use client";

import { useEffect } from "react";
import { loadQuestState, saveQuestState } from "@/lib/clientStorage";

const DEFAULT_ORDER = [
  "clue-3",
  "clue-1",
  "clue-6",
  "clue-2",
  "clue-5",
  "clue-7",
  "clue-4",
];

export function ClueLandingTracker({
  clueId,
  chapterNumber,
}: {
  clueId: string;
  chapterNumber: number;
}) {
  useEffect(() => {
    const state = loadQuestState(DEFAULT_ORDER);
    const found = Array.from(new Set([...state.foundClues, clueId]));
    const unlocked = Math.max(state.unlockedChapters, chapterNumber);
    saveQuestState({
      ...state,
      foundClues: found,
      unlockedChapters: unlocked,
    });

    void fetch("/api/quest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "qr_scan" }),
    });
  }, [clueId, chapterNumber]);

  return null;
}
