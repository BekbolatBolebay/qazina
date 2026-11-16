"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Heart, MessageCircle, Send } from "lucide-react";
import { useQazina } from "@/components/layout/QazinaProvider";
import type { MomentPost } from "@/types/user";

export default function MomentsPage() {
  const { profile, showToast } = useQazina();
  const [posts, setPosts] = useState<MomentPost[]>([]);
  const [kind, setKind] = useState<MomentPost["kind"]>("әсер");
  const [bookTitle, setBookTitle] = useState("Жатақхана құпиясы");
  const [quote, setQuote] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetch("/api/moments")
      .then((r) => r.json())
      .then((d) => setPosts(d.items || []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    try {
      const res = await fetch("/api/moments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_name: profile.display_name || "Оқырман",
          author_handle: "@qazina_reader",
          kind,
          book_title: bookTitle.trim() || "QAZINA үзіндісі",
          book_slug: "zhataqhana-qupiyasy",
          quote: quote.trim() || undefined,
          body: body.trim(),
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setPosts(d.items || []);
        setQuote("");
        setBody("");
        showToast("Сәт жарияланды!");
      }
    } finally {
      setPosting(false);
    }
  }

  async function handleLike(id: string) {
    const res = await fetch("/api/moments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "like", id }),
    });
    if (res.ok) {
      const d = await res.json();
      setPosts(d.items || []);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-card dark:border-[#2C3733] dark:bg-[#1D2421]">
        <h1 className="literary-text text-2xl font-bold text-[#173F35] dark:text-[#F3EFE7]">
          QAZINA Moments — Әдеби лента
        </h1>
        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
          Кітап оқудан алған әсерлер, үзінділер және әдеби сұрақтар. (Көңіл күй жазбалары автоматты жарияланбайды — құпиялылық қорғалған).
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["әсер", "үзінді", "пікір", "сұрақ"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                  kind === k
                    ? "bg-[#173F35] text-white"
                    : "bg-[#F8F5EF] text-neutral-700 dark:bg-[#141917] dark:text-neutral-300"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            placeholder="Кітап атауы..."
            className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3.5 py-2 text-xs outline-none focus:border-[#173F35] dark:border-[#2C3733] dark:bg-[#141917]"
          />

          <input
            type="text"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="Кітаптан үзінді (қалауыңыз бойынша)..."
            className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3.5 py-2 text-xs outline-none focus:border-[#173F35] dark:border-[#2C3733] dark:bg-[#141917]"
          />

          <textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Оқудан алған әсеріңмен бөліс..."
            className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] p-3 text-sm outline-none focus:border-[#173F35] dark:border-[#2C3733] dark:bg-[#141917]"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={posting || !body.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#173F35] px-4 py-2 text-xs font-bold text-white hover:bg-[#112F28] disabled:opacity-50"
            >
              <Send size={13} />
              Жариялау
            </button>
          </div>
        </form>
      </section>

      <div className="space-y-4">
        {posts.map((post) => (
          <article
            key={post.id}
            className="rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-sm dark:border-[#2C3733] dark:bg-[#1D2421]"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <span className="text-sm font-bold text-[#173F35] dark:text-[#F3EFE7]">
                  {post.author_name}
                </span>
                <span className="ml-2 text-xs text-neutral-400">
                  {post.author_handle}
                </span>
              </div>
              <span className="rounded-full bg-[#EFE8DD] px-2.5 py-0.5 text-[11px] font-bold text-[#173F35] dark:bg-[#26302C] dark:text-[#D4B382]">
                {post.kind}
              </span>
            </div>

            {post.quote && (
              <blockquote className="literary-text mb-3 rounded-xl border-l-4 border-[#B58B54] bg-[#F8F5EF] p-3 text-sm italic dark:bg-[#141917]">
                «{post.quote}»
              </blockquote>
            )}

            <p className="text-sm leading-relaxed text-[#242424] dark:text-[#F3EFE7]">
              {post.body}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EFE8DD] pt-3 text-xs dark:border-[#26302C]">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => void handleLike(post.id)}
                  className="inline-flex items-center gap-1 font-semibold text-neutral-600 hover:text-rose-600 dark:text-neutral-300"
                >
                  <Heart size={14} />
                  {post.likes}
                </button>
                <span className="inline-flex items-center gap-1 text-neutral-500">
                  <MessageCircle size={14} />
                  {post.comments.length}
                </span>
              </div>

              <Link
                href={`/books/${post.book_slug}`}
                className="inline-flex items-center gap-1 font-semibold text-[#173F35] hover:text-[#B58B54] dark:text-[#D4B382]"
              >
                <BookOpen size={13} />
                {post.book_title}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
