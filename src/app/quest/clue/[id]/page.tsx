import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, CheckCircle2, MapPin, Sparkles } from "lucide-react";
import { ClueLandingTracker } from "@/components/quest/ClueLandingTracker";
import { getQuestData } from "@/lib/books";

export default async function QuestCluePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quest = getQuestData();
  const clue = quest.clues.find((c) => c.id === id);

  if (!clue) {
    notFound();
  }

  const chapter = quest.chapters.find((c) => c.number === clue.chapter_number);
  const nextClue = quest.clues.find(
    (c) => c.order_index === clue.order_index + 1,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ClueLandingTracker clueId={clue.id} chapterNumber={clue.chapter_number} />

      <div className="rounded-3xl border border-[#B58B54]/40 bg-white p-6 shadow-literary dark:border-[#2C3733] dark:bg-[#1D2421] sm:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#173F35] px-3 py-1 text-xs font-bold text-white">
            <MapPin size={13} />
            {clue.location_name}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={15} />
            QR Үзінді №{clue.order_index} табылды!
          </span>
        </div>

        <h1 className="literary-text text-2xl font-bold text-[#173F35] dark:text-[#F3EFE7]">
          {clue.title}
        </h1>
        <p className="mt-1 text-xs text-[#B58B54]">{clue.secret_hint}</p>

        <div className="literary-text mt-5 space-y-3 rounded-2xl border-l-4 border-[#B58B54] bg-[#F8F5EF] p-5 text-lg leading-relaxed text-[#242424] dark:bg-[#141917] dark:text-[#F3EFE7]">
          {clue.excerpt.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          <p className="pt-1 font-sans text-sm font-extrabold text-[#173F35] dark:text-[#D4B382]">
            {clue.intrigue_line}
          </p>
        </div>

        {chapter && (
          <div className="mt-6 rounded-2xl border border-[#EFE8DD] bg-[#F8F5EF] p-4 dark:border-[#2C3733] dark:bg-[#141917]">
            <p className="text-xs font-semibold text-neutral-500">
              Бұл үзінді оқиғаның {chapter.number}-бөлімінен алынған ({chapter.title})
            </p>
            {nextClue && (
              <p className="mt-1 text-xs text-[#173F35] dark:text-[#D4B382]">
                Келесі із қайда болуы мүмкін? Бағыт: <strong>{nextClue.location_name}</strong>
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/read/${quest.slug}?chapter=${chapter?.id || "ch_01"}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#173F35] px-5 py-3 text-sm font-bold text-white hover:bg-[#112F28]"
          >
            <BookOpen size={16} />
            Толық бөлімді оқу
          </Link>

          <Link
            href="/quest"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#B58B54] px-5 py-3 text-sm font-bold text-white hover:bg-[#9E7642]"
          >
            <Sparkles size={16} />
            Квест-пазл мен 16 бөлімге өту
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
