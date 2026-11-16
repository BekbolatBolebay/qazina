"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Cloud, Lock, Moon, Sun, UserRound } from "lucide-react";
import { useQazina } from "@/components/layout/QazinaProvider";
import type { LanguageCode } from "@/types/book";
import type { AgeGroup } from "@/types/user";

const EMOJIS = ["🌿", "📖", "🦉", "🌙", "✨", "🍵"];

export default function ProfilePage() {
  const {
    profile,
    updateProfile,
    darkMode,
    toggleDarkMode,
    setLlmModalOpen,
    llmStatus,
    showToast,
  } = useQazina();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-card dark:border-[#2C3733] dark:bg-[#1D2421] sm:p-8">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EFE8DD] text-3xl dark:bg-[#26302C]">
            {profile.avatar_emoji}
          </div>
          <div>
            <h1 className="literary-text text-2xl font-bold text-[#173F35] dark:text-[#F3EFE7]">
              {profile.display_name}
            </h1>
            <p className="text-xs text-[#B58B54]">
              QAZINA Жеке кабинеті · Тіркеусіз локал профиль (Offline MVP)
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Аватар таңбасы</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => updateProfile({ avatar_emoji: em })}
                  className={`rounded-xl px-3 py-2 text-lg ${
                    profile.avatar_emoji === em
                      ? "bg-[#173F35] ring-2 ring-[#B58B54]"
                      : "bg-[#F8F5EF] dark:bg-[#141917]"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                <UserRound size={13} />
                Лақап ат
              </label>
              <input
                type="text"
                value={profile.display_name}
                onChange={(e) => updateProfile({ display_name: e.target.value })}
                className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3.5 py-2.5 text-sm outline-none focus:border-[#173F35] dark:border-[#2C3733] dark:bg-[#141917]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold">Жас санаты (Контент сүзгісі)</label>
              <select
                value={profile.age_group}
                onChange={(e) =>
                  updateProfile({ age_group: e.target.value as AgeGroup })
                }
                className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3.5 py-2.5 text-sm outline-none dark:border-[#2C3733] dark:bg-[#141917]"
              >
                <option value="10-13">10–13 жас (Жас оқырман)</option>
                <option value="14-17">14–17 жас (Жасөспірім)</option>
                <option value="18-24">18–24 жас (Студент)</option>
                <option value="25+">25+ (Ересектер)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold">Интерфейс тілі</label>
              <select
                value={profile.language}
                onChange={(e) =>
                  updateProfile({ language: e.target.value as LanguageCode })
                }
                className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3.5 py-2.5 text-sm outline-none dark:border-[#2C3733] dark:bg-[#141917]"
              >
                <option value="kk">Қазақша (негізгі)</option>
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={toggleDarkMode}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-4 py-2.5 text-sm font-semibold dark:border-[#2C3733] dark:bg-[#141917]"
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                {darkMode ? "Ашық (Жылы) тақырыпқа ауысу" : "Қараңғы тақырыпты қосу"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#EFE8DD] bg-[#F8F5EF] p-4 dark:border-[#2C3733] dark:bg-[#141917]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#173F35] dark:text-[#F3EFE7]">
                  <Cloud size={16} className="text-[#B58B54]" />
                  Бұлттық LLM API интеграциясы
                </h2>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">
                  Күйі:{" "}
                  {llmStatus.reachable
                    ? `Қосылған (${llmStatus.model})`
                    : "Offline MVP режимі (қауіпсіз локал алгоритм)"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLlmModalOpen(true)}
                className="rounded-xl bg-[#173F35] px-4 py-2 text-xs font-bold text-white"
              >
                API баптауы
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#EFE8DD] bg-[#F8F5EF] p-4 dark:border-[#2C3733] dark:bg-[#141917]">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={profile.save_mood_journal}
                onChange={(e) => {
                  updateProfile({ save_mood_journal: e.target.checked });
                  showToast("Құпиялылық баптауы жаңартылды");
                }}
                className="mt-1 accent-[#173F35]"
              />
              <div>
                <span className="flex items-center gap-1.5 text-sm font-bold text-[#173F35] dark:text-[#F3EFE7]">
                  <Lock size={14} className="text-[#B58B54]" />
                  Көңіл күй жазбаларын жеке сақтау (Section 20)
                </span>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">
                  Әдепкі бойынша көңіл күй мәтіндері серверде сақталмайды және модель үйретуге қолданылмайды.
                </p>
              </div>
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-card dark:border-[#2C3733] dark:bg-[#1D2421]">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-[#173F35] dark:text-[#F3EFE7]">
          <BookOpen size={18} className="text-[#B58B54]" />
          Оқу тарихы ({profile.reading_history.length})
        </h2>
        {profile.reading_history.length === 0 ? (
          <p className="text-xs text-neutral-500">
            Әзірге ашылған кітаптар жоқ. Кітапханадан немесе үзіндіден оқуды баста!
          </p>
        ) : (
          <div className="space-y-2">
            {profile.reading_history.map((h) => (
              <Link
                key={h.book_slug}
                href={`/read/${h.book_slug}?chapter=${h.chapter_id}${h.anchor ? `&anchor=${h.anchor}` : ""}`}
                className="flex items-center justify-between rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-4 py-3 text-sm transition hover:border-[#B58B54] dark:border-[#2C3733] dark:bg-[#141917]"
              >
                <div>
                  <div className="font-bold text-[#173F35] dark:text-[#F3EFE7]">
                    {h.book_title}
                  </div>
                  <div className="text-xs text-neutral-500">{h.chapter_title}</div>
                </div>
                <span className="text-xs font-bold text-[#B58B54]">
                  Жалғастыру →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
