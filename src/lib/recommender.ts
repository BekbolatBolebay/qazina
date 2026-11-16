import type { Fragment, HiddenFragmentPayload } from "@/types/fragment";
import type {
  MoodAnalysisResult,
  RecommendationRequest,
  RecommendationResponse,
} from "@/types/recommendation";
import { getBookById, isRightsApproved, maxAllowedAgeForGroup } from "./books";
import { getApprovedFragments } from "./fragments";
import {
  callAlemReranker,
  callCloudLLM,
  extractJSONObject,
  type LLMConfig,
} from "./llm";
import { analyzeMoodInput } from "./mood";

interface ScoredCandidate {
  fragment: Fragment;
  score: number;
  breakdown: HiddenFragmentPayload["score_breakdown"];
}

function computeMoodMatch(
  fragment: Fragment,
  analysis: MoodAnalysisResult,
  rerankBoost = 0,
): number {
  let match = 0.25;
  const moodIdx = fragment.moods.indexOf(analysis.emotion);
  if (moodIdx === 0) match = 0.92;
  else if (moodIdx === 1) match = 0.8;
  else if (moodIdx >= 2) match = 0.68;

  if (fragment.reader_intents.includes(analysis.reader_intent)) {
    match = Math.min(1.0, match + 0.12);
  }

  for (const topic of analysis.topics) {
    if (fragment.topics.includes(topic)) {
      match = Math.min(1.0, match + 0.08);
    }
  }

  if (rerankBoost > 0) {
    match = Math.min(1.0, Math.max(match, rerankBoost));
  }

  return Number(match.toFixed(3));
}

function scoreCandidate(
  fragment: Fragment,
  analysis: MoodAnalysisResult,
  preferDialogue: boolean,
  rerankScore = 0,
): ScoredCandidate {
  const moodMatch = computeMoodMatch(fragment, analysis, rerankScore);
  const hookScore = fragment.hook_score;
  const dialogueQuality = fragment.dialogue_score;
  const emotionalRelevance =
    rerankScore > 0
      ? Number(Math.max(fragment.emotional_relevance, rerankScore).toFixed(3))
      : fragment.emotional_relevance;
  const readability = fragment.readability;
  const contextClarity = fragment.context_clarity;

  let score =
    0.3 * moodMatch +
    0.25 * hookScore +
    0.15 * dialogueQuality +
    0.15 * emotionalRelevance +
    0.1 * readability +
    0.05 * contextClarity;

  if (preferDialogue && fragment.type === "dialogue") {
    score += 0.04;
  }

  if (fragment.language === analysis.language) {
    score += 0.03;
  }

  return {
    fragment,
    score: Number(Math.min(0.999, score).toFixed(4)),
    breakdown: {
      mood_match: moodMatch,
      hook_score: hookScore,
      dialogue_quality: dialogueQuality,
      emotional_relevance: emotionalRelevance,
      readability,
      context_clarity: contextClarity,
    },
  };
}

function toHiddenPayload(
  candidate: ScoredCandidate,
  engineMode: "cloud-llm" | "offline-mvp",
  engineModel?: string,
): HiddenFragmentPayload {
  const f = candidate.fragment;
  return {
    fragment_id: f.id,
    text: f.text,
    type: f.type,
    language: f.language,
    dialogue_category: f.dialogue_category,
    moods: f.moods,
    topics: f.topics,
    revealed: false,
    ranking_score: candidate.score,
    score_breakdown: candidate.breakdown,
    dilemma: f.dilemma,
    actions: ["like", "save", "share", "reveal", "skip"],
    engine_mode: engineMode,
    engine_model: engineModel,
  };
}

export async function recommendFragment(
  req: RecommendationRequest,
  llmConfig?: LLMConfig,
): Promise<RecommendationResponse> {
  const analysis =
    req.analysis ||
    (await analyzeMoodInput({
      mood_text: req.mood_text,
      selected_mood: req.selected_mood,
      intent: req.intent,
      llmConfig,
    }));

  if (analysis.safety_alert) {
    return {
      analysis,
      fragment: null,
      remaining_candidates: 0,
    };
  }

  const maxAge = maxAllowedAgeForGroup(req.age_group || "18-24");
  const exclude = new Set(req.exclude_ids || []);
  const preferDialogue = req.prefer_dialogue !== false;

  const filterPool = (
    ignoreExcluded: boolean,
    ignoreLangFilter: boolean,
    driveOnly: boolean,
  ) =>
    getApprovedFragments().filter((f) => {
      if (!ignoreExcluded && exclude.has(f.id)) return false;
      const book = getBookById(f.book_id);
      if (!book || !isRightsApproved(book.rights_status)) return false;
      if (driveOnly && !book.drive_file_id) return false;
      if (book.chapters.length === 0) return false;
      if (f.age_min > maxAge || book.age_min > maxAge) return false;
      if (
        !ignoreLangFilter &&
        req.language &&
        req.language !== "all" &&
        f.language !== req.language
      ) {
        return false;
      }
      return true;
    });

  // Always prioritize fragments from the user's Google Drive books first
  let pool = filterPool(false, false, true);
  if (pool.length === 0) pool = filterPool(false, true, true);
  if (pool.length === 0) pool = filterPool(false, false, false);
  if (pool.length === 0) pool = filterPool(false, true, false);
  if (pool.length === 0) pool = filterPool(true, true, true);
  if (pool.length === 0) pool = filterPool(true, true, false);

  if (pool.length === 0) {
    return { analysis, fragment: null, remaining_candidates: 0 };
  }

  // Step 1: Initial heuristic scoring
  let scored = pool
    .map((f) => scoreCandidate(f, analysis, preferDialogue))
    .sort((a, b) => b.score - a.score);

  let engineMode: "cloud-llm" | "offline-mvp" =
    analysis.engine === "cloud-llm" ? "cloud-llm" : "offline-mvp";
  let engineModel = analysis.model;

  // Step 2: Alem Plus Neural Reranker across top 10 candidates
  const queryStr =
    (req.mood_text || "").trim() ||
    `${analysis.emotion} ${analysis.reader_intent}`;
  const topForRerank = scored.slice(0, 10);
  const rerankScores = await callAlemReranker(
    queryStr,
    topForRerank.map(
      (c) => `${c.fragment.moods.join(", ")}: ${c.fragment.text}`,
    ),
    6,
  );

  if (rerankScores) {
    scored = scored
      .map((c, idx) => {
        const rs = idx < topForRerank.length ? rerankScores.get(idx) || 0 : 0;
        return scoreCandidate(c.fragment, analysis, preferDialogue, rs);
      })
      .sort((a, b) => b.score - a.score);

    engineMode = "cloud-llm";
    engineModel = engineModel ? `${engineModel} + reranker` : "reranker";
  }

  let chosen = scored[0];

  // Step 3: Semantic selection over top 5 candidates via Cloud LLM (strictly verbatim ID pick)
  if (llmConfig?.apiKey && scored.length > 1) {
    const topCandidates = scored.slice(0, 5).map((c) => ({
      id: c.fragment.id,
      type: c.fragment.type,
      moods: c.fragment.moods,
      excerpt: c.fragment.text.slice(0, 220),
    }));

    const rerankPrompt = `You are QAZINA Fragment Ranker. Pick ONE best matching fragment id from the verified list below for the reader's state. Prioritize dialogues when fitting.
Reply ONLY with JSON: {"selected_id":"..."}`;

    const llmPick = await callCloudLLM(
      [
        { role: "system", content: rerankPrompt },
        {
          role: "user",
          content: `State: "${queryStr}"\nMood: ${analysis.emotion}, intent: ${analysis.reader_intent}\nCandidates:\n${JSON.stringify(topCandidates)}`,
        },
      ],
      llmConfig,
      6500,
    );

    if (llmPick) {
      const jsonStr = extractJSONObject(llmPick.content);
      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr);
          const hit = scored.find((c) => c.fragment.id === parsed.selected_id);
          if (hit) {
            chosen = hit;
            engineMode = "cloud-llm";
            engineModel = rerankScores
              ? `${llmPick.model} + reranker`
              : llmPick.model;
          }
        } catch {
          // keep top score
        }
      }
    }
  }

  return {
    analysis,
    fragment: toHiddenPayload(chosen, engineMode, engineModel),
    remaining_candidates: Math.max(0, scored.length - 1),
  };
}
