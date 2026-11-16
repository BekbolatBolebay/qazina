"use client";

import React, { useState } from "react";
import { BookmarkPlus, X } from "lucide-react";
import {
  COLLECTION_CATEGORIES,
  saveFragmentLocal,
} from "@/lib/clientStorage";
import type {
  CollectionCategory,
  CollectionColor,
  SavedFragmentItem,
} from "@/types/user";

interface SaveThoughtModalProps {
  open: boolean;
  onClose: () => void;
  fragmentId: string;
  text: string;
  revealed: boolean;
  bookSlug?: string;
  bookTitle?: string;
  author?: string;
  chapterId?: string;
  onSaved: (item: SavedFragmentItem) => void;
}

export function SaveThoughtModal({
  open,
  onClose,
  fragmentId,
  text,
  revealed,
  bookSlug,
  bookTitle,
  author,
  chapterId,
  onSaved,
}: SaveThoughtModalProps) {
  const [category, setCategory] =
    useState<CollectionCategory>("Жүрегіме жақын");
  const [color, setColor] = useState<CollectionColor>("green");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const item: SavedFragmentItem = {
      id: `saved_${fragmentId}`,
      fragment_id: fragmentId,
      text,
      revealed,
      book_slug: bookSlug,
      book_title: bookTitle,
      author,
      chapter_id: chapterId,
      category,
      color,
      note: note.trim(),
      saved_at: new Date().toISOString(),
    };

    saveFragmentLocal(item);

    try {
      await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
    } catch {
      // Offline MVP still persists in localStorage
    }

    setSaving(false);
    onSaved(item);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Ой сақтау"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#EFE8DD] bg-white p-6 shadow-xl dark:border-[#2C3733] dark:bg-[#1D2421]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#173F35] dark:text-[#F3EFE7]">
            <BookmarkPlus size={19} className="text-[#B58B54]" />
            Ой сақтау (Жеке жинақ)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-500 hover:bg-[#EFE8DD] dark:hover:bg-[#26302C]"
            aria-label="Жабу"
          >
            <X size={18} />
          </button>
        </div>

        <blockquote className="literary-text mb-4 line-clamp-3 rounded-xl border-l-4 border-[#B58B54] bg-[#F8F5EF] p-3 text-xs italic text-neutral-700 dark:bg-[#141917] dark:text-neutral-300">
          «{text}»
        </blockquote>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              Санат пен түстік белгі:
            </p>
            <div className="flex flex-wrap gap-2">
              {COLLECTION_CATEGORIES.map((c) => {
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCategory(c.id);
                      setColor(c.color);
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? `${c.badgeClass} ring-2 ring-[#B58B54] ring-offset-1`
                        : "border border-[#EFE8DD] bg-[#F8F5EF] text-[#242424] dark:border-[#2C3733] dark:bg-[#141917] dark:text-[#F3EFE7]"
                    }`}
                  >
                    {c.id}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              Жеке ескертпе («Ой сақтау»):
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Бұл үзінді неге ерекше әсер етті? Ойыңды жазып қой..."
              className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] p-3 text-sm outline-none focus:border-[#173F35] dark:border-[#2C3733] dark:bg-[#141917]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-[#EFE8DD] dark:text-neutral-300"
            >
              Болдырмау
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#173F35] px-5 py-2 text-sm font-semibold text-white hover:bg-[#112F28]"
            >
              Жинаққа сақтау
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
