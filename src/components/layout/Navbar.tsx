"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  BookOpen,
  Cloud,
  Home,
  KeySquare,
  Menu,
  MessageSquareHeart,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import type { LanguageCode } from "@/types/book";
import { CloudLLMModal } from "./CloudLLMModal";
import { useQazina } from "./QazinaProvider";

export function Navbar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const {
    lang,
    setLang,
    darkMode,
    toggleDarkMode,
    copy,
    setLlmModalOpen,
    llmStatus,
  } = useQazina();

  const allLinks = [
    { href: "/", label: copy.nav.home, icon: Home },
    { href: "/discover", label: copy.nav.discover, icon: Sparkles },
    { href: "/quest", label: copy.nav.quest, icon: KeySquare },
    { href: "/books", label: copy.nav.books, icon: BookOpen },
    { href: "/moments", label: copy.nav.moments, icon: MessageSquareHeart },
    { href: "/saved", label: copy.nav.saved, icon: Bookmark },
    { href: "/profile", label: copy.nav.profile, icon: UserRound },
    { href: "/admin", label: copy.nav.admin, icon: ShieldCheck },
  ];

  // Primary 5 mobile bottom dock tabs
  const mobileBottomLinks = [
    { href: "/", label: copy.nav.home, icon: Home },
    { href: "/discover", label: copy.nav.discover, icon: Sparkles },
    { href: "/quest", label: copy.nav.quest, icon: KeySquare },
    { href: "/books", label: copy.nav.books, icon: BookOpen },
    { href: "/saved", label: copy.nav.saved, icon: Bookmark },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b border-[#EFE8DD] bg-[#F8F5EF]/95 backdrop-blur-md dark:border-[#26302C] dark:bg-[#141917]/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#EFE8DD] bg-white text-[#173F35] transition hover:border-[#B58B54] dark:border-[#2C3733] dark:bg-[#1D2421] dark:text-[#F3EFE7] lg:hidden"
              aria-label="Навигация мәзірі"
              aria-expanded={drawerOpen}
            >
              {drawerOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#173F35] text-sm font-bold text-[#F8F5EF] shadow-sm sm:h-9 sm:w-9">
                Q
              </span>
              <div className="min-w-0">
                <div className="text-sm font-extrabold tracking-wide text-[#173F35] dark:text-[#F3EFE7] sm:text-base">
                  {copy.brand}
                </div>
                <div className="hidden truncate text-[11px] text-[#B58B54] sm:block">
                  {copy.slogan}
                </div>
              </div>
            </Link>
          </div>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Негізгі мәзір">
            {allLinks.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? "bg-[#173F35] text-white shadow-sm"
                      : "text-[#242424] hover:bg-[#EFE8DD] dark:text-[#F3EFE7] dark:hover:bg-[#26302C]"
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLlmModalOpen(true)}
              className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition sm:px-2.5 sm:text-xs ${
                llmStatus.reachable
                  ? "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "border-[#EFE8DD] bg-white text-[#173F35] hover:border-[#B58B54] dark:border-[#2C3733] dark:bg-[#1D2421] dark:text-[#D4B382]"
              }`}
              title="Cloud LLM API баптау"
            >
              <Cloud size={14} />
              <span>{llmStatus.reachable ? "Cloud" : "AI"}</span>
            </button>

            <div className="flex rounded-xl border border-[#EFE8DD] bg-white p-0.5 dark:border-[#2C3733] dark:bg-[#1D2421]">
              {(["kk", "ru", "en"] as LanguageCode[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`rounded-lg px-1.5 py-1 text-[10px] font-bold uppercase transition sm:px-2 sm:text-[11px] ${
                    lang === code
                      ? "bg-[#173F35] text-white"
                      : "text-neutral-600 hover:text-[#173F35] dark:text-neutral-300"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#EFE8DD] bg-white text-[#242424] transition hover:border-[#B58B54] dark:border-[#2C3733] dark:bg-[#1D2421] dark:text-[#F3EFE7] sm:h-9 sm:w-9"
              aria-label="Тақырыпты ауыстыру"
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>

        {/* Mobile Quick Horizontal Section Bar (1-tap access to all 8 pages) */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-t border-[#EFE8DD]/80 px-3 py-2 dark:border-[#26302C] lg:hidden">
          {allLinks.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-[#173F35] text-white shadow-sm"
                    : "bg-white text-[#242424] ring-1 ring-[#EFE8DD] dark:bg-[#1D2421] dark:text-[#F3EFE7] dark:ring-[#2C3733]"
                }`}
              >
                <Icon size={13} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Expandable Mobile Navigation Drawer */}
        {drawerOpen && (
          <div className="border-t border-[#EFE8DD] bg-white px-4 py-4 shadow-lg dark:border-[#26302C] dark:bg-[#1D2421] lg:hidden">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#B58B54]">
              {copy.slogan}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {allLinks.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-xs font-bold transition ${
                      active
                        ? "bg-[#173F35] text-white"
                        : "bg-[#F8F5EF] text-[#242424] dark:bg-[#141917] dark:text-[#F3EFE7]"
                    }`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Fixed Mobile Bottom Navigation Panel */}
      <nav
        className="no-print fixed bottom-0 left-0 right-0 z-40 border-t border-[#EFE8DD] bg-white/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-6px_24px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-[#26302C] dark:bg-[#1D2421]/95 lg:hidden"
        aria-label="Мобильді навигация"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2">
          {mobileBottomLinks.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 text-[10px] font-bold transition ${
                  active
                    ? "bg-[#173F35]/10 text-[#173F35] dark:bg-[#D4B382]/15 dark:text-[#D4B382]"
                    : "text-neutral-500 hover:text-[#173F35] dark:text-neutral-400"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
                <span className="truncate max-w-full">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <CloudLLMModal />
    </>
  );
}
