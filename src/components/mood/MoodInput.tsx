"use client";

import React, { useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  HeartHandshake,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
} from "lucide-react";
import { useQazina } from "@/components/layout/QazinaProvider";
import { buildLLMHeaders } from "@/lib/clientStorage";
import { INTENT_OPTIONS, MOOD_OPTIONS } from "@/lib/mood";
import type { LanguageCode } from "@/types/book";
import type { MoodTag, ReaderIntent } from "@/types/fragment";
import type { RecommendationResponse } from "@/types/recommendation";
import type { AgeGroup } from "@/types/user";

interface MoodInputProps {
  onResult: (res: RecommendationResponse, rawMoodText: string) => void;
  compact?: boolean;
  hideHeader?: boolean;
}

export function MoodInput({
  onResult,
  compact = false,
  hideHeader = false,
}: MoodInputProps) {
  const { copy, lang, profile, updateProfile, showToast } = useQazina();
  const [moodText, setMoodText] = useState("");
  const [selectedMood, setSelectedMood] = useState<MoodTag | undefined>("шаршау");
  const [selectedIntent, setSelectedIntent] = useState<ReaderIntent | undefined>();
  const [bookLang, setBookLang] = useState<LanguageCode | "all">("all");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [error, setError] = useState("");
  const [safetyAlert, setSafetyAlert] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const ocrInputRef = useRef<HTMLInputElement | null>(null);

  async function submitMood(overrideMood?: MoodTag) {
    const activeMood = overrideMood ?? selectedMood;
    const trimmed = moodText.trim();

    if (!trimmed && !activeMood) {
      setError(copy.mood.emptyError);
      return;
    }

    setError("");
    setSafetyAlert(null);
    setLoading(true);

    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildLLMHeaders(),
        },
        body: JSON.stringify({
          mood_text: trimmed,
          selected_mood: activeMood,
          intent: selectedIntent,
          language: bookLang,
          age_group: profile.age_group,
          prefer_dialogue: true,
        }),
      });

      const data = (await res.json()) as RecommendationResponse & { error?: string };
      if (!res.ok) {
        setError(data.error || "Қате орын алды. Қайталап көріңіз.");
        setLoading(false);
        return;
      }

      if (data.analysis?.safety_alert && data.analysis.safety_message) {
        setSafetyAlert(data.analysis.safety_message);
        setLoading(false);
        return;
      }

      onResult(data, trimmed || activeMood || "");
    } catch {
      setError("Желі қатесі. Қайталап көріңіз.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleVoiceRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Бұл браузерде микрофон қолдауы жоқ");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 200) return;
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("file", blob, "voice.webm");
          form.append("language", lang);
          const res = await fetch("/api/audio/transcribe", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          if (res.ok && data?.text) {
            setMoodText((prev) =>
              prev.trim() ? `${prev.trim()} ${data.text}` : data.text,
            );
            showToast(`Дауыс мәтінге айналды (${data.model})`);
          } else {
            showToast(data?.error || "Дауысты тану сәтсіз болды");
          }
        } catch {
          showToast("Аудио серверіне қосылу сәтсіз болды");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      showToast("Микрофонға рұқсат берілмеді");
    }
  }

  async function handleOcrFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOcrBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_data_url: dataUrl }),
      });
      const data = await res.json();
      if (res.ok && data?.text) {
        setMoodText(data.text.slice(0, 1000));
        showToast("Суреттегі мәтін DeepSeek OCR арқылы оқылды");
      } else {
        showToast(data?.error || "Суреттен мәтін табылмады");
      }
    } catch {
      showToast("Суретті оқу сәтсіз аяқталды");
    } finally {
      setOcrBusy(false);
    }
  }

  function handleChipClick(mood: MoodTag) {
    const next = selectedMood === mood ? undefined : mood;
    setSelectedMood(next);
    if (next && !moodText.trim()) {
      void submitMood(next);
    }
  }

  return (
    <section
      className={`rounded-3xl border border-[#e9ebe2] bg-[#fffefa] shadow-literary dark:border-[#2C3733] dark:bg-[#1D2421] ${
        compact ? "p-5" : "p-5 sm:p-6"
      }`}
      aria-label="Көңіл күйді енгізу"
    >
      {!hideHeader && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#EFE8DD] px-3 py-1 text-xs font-semibold text-[#173F35] dark:bg-[#26302C] dark:text-[#D4B382]">
            <Sparkles size={13} className="text-[#B58B54]" />
            {copy.mood.dialogueFirst}
          </span>

          <div className="grid w-full grid-cols-2 items-center gap-2 text-xs sm:flex sm:w-auto sm:flex-wrap">
            <select
              value={profile.age_group}
              onChange={(e) =>
                updateProfile({ age_group: e.target.value as AgeGroup })
              }
              aria-label="Жас санаты"
              className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-2.5 py-2 text-xs font-semibold text-[#173F35] outline-none dark:border-[#2C3733] dark:bg-[#141917] dark:text-[#F3EFE7] sm:w-auto sm:rounded-lg sm:py-1"
            >
              <option value="10-13">10–13 жас</option>
              <option value="14-17">14–17 жас</option>
              <option value="18-24">18–24 (Студент)</option>
              <option value="25+">25+ Ересектер</option>
            </select>

            <select
              value={bookLang}
              onChange={(e) =>
                setBookLang(e.target.value as LanguageCode | "all")
              }
              aria-label="Мәтін тілі"
              className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-2.5 py-2 text-xs font-semibold text-[#173F35] outline-none dark:border-[#2C3733] dark:bg-[#141917] dark:text-[#F3EFE7] sm:w-auto sm:rounded-lg sm:py-1"
            >
              <option value="all">Барлық тіл</option>
              <option value="kk">Қазақша</option>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitMood();
        }}
        className="space-y-4"
      >
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label
              htmlFor="mood-textarea"
              className="text-xs font-extrabold text-[#253b30] dark:text-[#F3EFE7]"
            >
              Қазір не сезініп отырсың?
            </label>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void toggleVoiceRecording()}
                disabled={transcribing}
                title="Дауыспен жазу (Alem Speech-to-Text KK)"
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                  recording
                    ? "bg-rose-600 text-white"
                    : "bg-[#EFE8DD] text-[#173F35] hover:bg-[#dfeddf] dark:bg-[#26302C] dark:text-[#D4B382]"
                }`}
              >
                {transcribing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : recording ? (
                  <MicOff size={12} />
                ) : (
                  <Mic size={12} />
                )}
                {recording ? "Тоқтату" : transcribing ? "Тану..." : "Дауыс"}
              </button>

              <button
                type="button"
                onClick={() => ocrInputRef.current?.click()}
                disabled={ocrBusy}
                title="Кітап бетінің фотосынан мәтін оқу (DeepSeek OCR)"
                className="inline-flex items-center gap-1 rounded-lg bg-[#EFE8DD] px-2 py-1 text-[11px] font-bold text-[#173F35] transition hover:bg-[#dfeddf] dark:bg-[#26302C] dark:text-[#D4B382]"
              >
                {ocrBusy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Camera size={12} />
                )}
                {ocrBusy ? "Оқу..." : "OCR"}
              </button>

              <input
                ref={ocrInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void handleOcrFile(e)}
                className="hidden"
              />
            </div>
          </div>

          <div className="relative">
            <textarea
              id="mood-textarea"
              rows={compact ? 2 : 3}
              maxLength={1000}
              value={moodText}
              onChange={(e) => {
                setMoodText(e.target.value);
                if (error) setError("");
              }}
              placeholder={copy.mood.placeholder}
              className="w-full resize-none rounded-xl border border-[#e2e8dd] bg-[#fafaf6] px-3.5 py-3 text-sm leading-relaxed text-[#242424] placeholder:text-neutral-400 focus:border-[#8fb59b] focus:bg-white focus:outline-none dark:border-[#2C3733] dark:bg-[#141917] dark:text-[#F3EFE7] dark:focus:border-[#B58B54]"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-neutral-400">
              {moodText.length}/1000
            </span>
          </div>
        </div>

        {/* Preset Mood Chips */}
        <div>
          <p className="mb-2 text-xs font-extrabold text-[#253b30] dark:text-[#D4B382]">
            {lang === "ru"
              ? "Выбери настроение"
              : lang === "en"
                ? "Pick your mood"
                : "Көңіл күйіңді таңда"}
          </p>
          <div className="flex flex-wrap gap-2">
            {MOOD_OPTIONS.map((m) => {
              const active = selectedMood === m.id;
              const label =
                lang === "ru"
                  ? m.label_ru
                  : lang === "en"
                    ? m.label_en
                    : m.label_kk;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleChipClick(m.id)}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${
                    active
                      ? "border border-[#b3cfb7] bg-[#dfeddf] font-bold text-[#356c4e] dark:border-[#B58B54] dark:bg-[#173F35] dark:text-white"
                      : "border border-[#e1e6df] bg-white text-[#69786c] hover:border-[#b3cfb7] dark:border-[#2C3733] dark:bg-[#141917] dark:text-[#F3EFE7]"
                  }`}
                >
                  {active ? `✦ ${label}` : label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Reader Intent Chips */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
            {copy.mood.intentLabel}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {INTENT_OPTIONS.map((item) => {
              const active = selectedIntent === item.id;
              const label =
                lang === "ru"
                  ? item.label_ru
                  : lang === "en"
                    ? item.label_en
                    : item.label_kk;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setSelectedIntent(active ? undefined : item.id)
                  }
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? "bg-[#B58B54] text-white"
                      : "bg-[#EFE8DD]/70 text-[#242424] hover:bg-[#EFE8DD] dark:bg-[#26302C] dark:text-[#F3EFE7]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-200"
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {safetyAlert && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-700/30 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100"
          >
            <div className="mb-1.5 flex items-center gap-2 font-bold">
              <HeartHandshake size={18} className="text-[#173F35] dark:text-emerald-300" />
              Қолдау мен қамқорлық
            </div>
            <p className="leading-relaxed">{safetyAlert}</p>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2f6a50] px-5 py-3.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#245941] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {copy.mood.searching}
              </>
            ) : (
              <>✦ Маған үзінді тап →</>
            )}
          </button>

          <p className="text-[11px] leading-relaxed text-[#89958b] dark:text-neutral-400">
            🔒 Жазғандарың серверде сақталмайды. Жеке жинақ деректері браузерде қалады.
          </p>
        </div>
      </form>
    </section>
  );
}
