"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, BookOpen, Edit3, Trash2 } from "lucide-react";
import { useQazina } from "@/components/layout/QazinaProvider";
import {
  COLLECTION_CATEGORIES,
  loadSavedFragments,
  removeSavedFragmentLocal,
  saveFragmentLocal,
} from "@/lib/clientStorage";
import type { CollectionCategory, SavedFragmentItem } from "@/types/user";

export default function SavedPage() {
  const { showToast } = useQazina();
  const [items, setItems] = useState<SavedFragmentItem[]>([]);
  const [filterCat, setFilterCat] = useState<CollectionCategory | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    const local = loadSavedFragments();
    setItems(local);

    fetch("/api/saved")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items) && d.items.length > 0 && local.length === 0) {
          setItems(d.items);
        }
      })
      .catch(() => {});
  }, []);

  function handleDelete(item: SavedFragmentItem) {
    const next = removeSavedFragmentLocal(item.id);
    setItems(next);
    void fetch(`/api/saved/${encodeURIComponent(item.id)}`, {
      method: "DELETE",
    });
    showToast("Үзінді жинақтан жойылды");
  }

  function handleSaveNote(item: SavedFragmentItem) {
    const updated = { ...item, note: noteDraft.trim() };
    const next = saveFragmentLocal(updated);
    setItems(next);
    setEditingId(null);
    void fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    showToast("Ескертпе жаңартылды");
  }

  const visible =
    filterCat === "all"
      ? items
      : items.filter((i) => i.category === filterCat);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-card dark:border-[#2C3733] dark:bg-[#1D2421]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="literary-text flex items-center gap-2 text-2xl font-bold text-[#173F35] dark:text-[#F3EFE7]">
              <Bookmark size={22} className="text-[#B58B54]" />
              Жеке жинақ · «Ой сақтау» ({items.length})
            </h1>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
              Сақталған үзінділер, жеке ескертпелер және түстік санаттар. Браузерде және серверде сақталады.
            </p>
          </div>
          <Link
            href="/discover"
            className="rounded-xl bg-[#173F35] px-4 py-2 text-xs font-bold text-white"
          >
            Жаңа үзінді табу
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterCat("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filterCat === "all"
                ? "bg-[#173F35] text-white"
                : "bg-[#F8F5EF] text-neutral-700 dark:bg-[#141917] dark:text-neutral-300"
            }`}
          >
            Барлығы ({items.length})
          </button>
          {COLLECTION_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilterCat(c.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                filterCat === c.id
                  ? c.badgeClass
                  : "bg-[#F8F5EF] text-neutral-700 dark:bg-[#141917] dark:text-neutral-300"
              }`}
            >
              {c.id}
            </button>
          ))}
        </div>
      </section>

      {visible.length === 0 ? (
        <div className="rounded-3xl border border-[#EFE8DD] bg-white p-10 text-center dark:border-[#2C3733] dark:bg-[#1D2421]">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Бұл санатта әзірге сақталған үзінді жоқ. Басты беттен көңіл күйіңе сай үзінді тауып, «Ой сақтау» батырмасын бас!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((item) => {
            const catMeta = COLLECTION_CATEGORIES.find(
              (c) => c.id === item.category,
            );
            return (
              <article
                key={item.id}
                className="rounded-3xl border border-[#EFE8DD] bg-white p-6 shadow-sm dark:border-[#2C3733] dark:bg-[#1D2421]"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      catMeta?.badgeClass || "bg-[#173F35] text-white"
                    }`}
                  >
                    {item.category}
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    {new Date(item.saved_at).toLocaleDateString("kk-KZ")}
                  </span>
                </div>

                <blockquote className="literary-text whitespace-pre-line border-l-4 border-[#B58B54] pl-4 text-base leading-relaxed text-[#242424] dark:text-[#F3EFE7]">
                  «{item.text}»
                </blockquote>

                {item.book_title && (
                  <p className="mt-3 text-xs font-semibold text-[#B58B54]">
                    {item.book_title} — {item.author}
                  </p>
                )}

                {editingId === item.id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      rows={2}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] p-2.5 text-sm outline-none dark:border-[#2C3733] dark:bg-[#141917]"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveNote(item)}
                        className="rounded-lg bg-[#173F35] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Сақтау
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg px-3 py-1.5 text-xs text-neutral-500"
                      >
                        Бас тарту
                      </button>
                    </div>
                  </div>
                ) : (
                  item.note && (
                    <div className="mt-3 rounded-xl bg-[#F8F5EF] px-3.5 py-2.5 text-xs text-neutral-700 dark:bg-[#141917] dark:text-neutral-300">
                      <strong className="text-[#173F35] dark:text-[#D4B382]">
                        Ескертпе:
                      </strong>{" "}
                      {item.note}
                    </div>
                  )
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EFE8DD] pt-3 dark:border-[#26302C]">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setNoteDraft(item.note || "");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#F8F5EF] px-2.5 py-1.5 text-xs font-semibold hover:bg-[#EFE8DD] dark:bg-[#141917]"
                    >
                      <Edit3 size={13} />
                      Ескертпе
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300"
                    >
                      <Trash2 size={13} />
                      Жою
                    </button>
                  </div>

                  {item.book_slug && (
                    <Link
                      href={`/read/${item.book_slug}?anchor=${encodeURIComponent(item.fragment_id)}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#173F35] px-3.5 py-1.5 text-xs font-bold text-white"
                    >
                      <BookOpen size={13} />
                      Кітапты ашу →
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
