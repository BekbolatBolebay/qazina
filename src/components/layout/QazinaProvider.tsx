"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { UI_COPY } from "@/lib/i18n";
import {
  DEFAULT_PROFILE,
  loadLLMSettings,
  loadUserProfile,
  saveLLMSettings,
  saveUserProfile,
  type ClientLLMSettings,
} from "@/lib/clientStorage";
import type { LanguageCode } from "@/types/book";
import type { UserProfile } from "@/types/user";

interface LLMServerStatus {
  configured: boolean;
  reachable: boolean;
  provider: string;
  model: string;
  services?: string[];
}

interface QazinaContextValue {
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  copy: (typeof UI_COPY)["kk"];
  llmSettings: ClientLLMSettings;
  updateLLMSettings: (s: ClientLLMSettings) => void;
  llmModalOpen: boolean;
  setLlmModalOpen: (open: boolean) => void;
  llmStatus: LLMServerStatus;
  refreshLLMStatus: (override?: ClientLLMSettings) => Promise<LLMServerStatus>;
  toast: string;
  showToast: (msg: string) => void;
}

const QazinaContext = createContext<QazinaContextValue | null>(null);

export function QazinaProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [llmSettings, setLlmSettings] = useState<ClientLLMSettings>({
    apiUrl: "https://llm.alem.ai/v1/chat/completions",
    apiKey: "",
    model: "qwen3-8",
  });
  const [llmModalOpen, setLlmModalOpen] = useState(false);
  const [llmStatus, setLlmStatus] = useState<LLMServerStatus>({
    configured: false,
    reachable: false,
    provider: "alem",
    model: "qwen3-8",
    services: [],
  });
  const [toast, setToast] = useState("");

  async function refreshLLMStatus(override?: ClientLLMSettings): Promise<LLMServerStatus> {
    const cfg = override || loadLLMSettings();
    try {
      const res = await fetch("/api/llm/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (res.ok) {
        const data = (await res.json()) as LLMServerStatus;
        setLlmStatus(data);
        return data;
      }
    } catch {
      // ignore network error
    }
    return llmStatus;
  }

  useEffect(() => {
    const loaded = loadUserProfile();
    setProfile(loaded);
    document.documentElement.classList.toggle("dark", loaded.dark_mode);

    const savedLLM = loadLLMSettings();
    setLlmSettings(savedLLM);
    void refreshLLMStatus(savedLLM);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  function updateProfile(patch: Partial<UserProfile>) {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveUserProfile(next);
      document.documentElement.classList.toggle("dark", next.dark_mode);
      return next;
    });
  }

  function setLang(lang: LanguageCode) {
    updateProfile({ language: lang });
  }

  function toggleDarkMode() {
    updateProfile({ dark_mode: !profile.dark_mode });
  }

  function updateLLMSettings(next: ClientLLMSettings) {
    setLlmSettings(next);
    saveLLMSettings(next);
    void refreshLLMStatus(next);
  }

  function showToast(msg: string) {
    setToast(msg);
  }

  return (
    <QazinaContext.Provider
      value={{
        profile,
        updateProfile,
        lang: profile.language,
        setLang,
        darkMode: profile.dark_mode,
        toggleDarkMode,
        copy: UI_COPY[profile.language] || UI_COPY.kk,
        llmSettings,
        updateLLMSettings,
        llmModalOpen,
        setLlmModalOpen,
        llmStatus,
        refreshLLMStatus,
        toast,
        showToast,
      }}
    >
      {children}
      {toast && (
        <div
          role="status"
          className="no-print fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#173F35] px-5 py-2.5 text-sm font-medium text-white shadow-lg md:bottom-6"
        >
          {toast}
        </div>
      )}
    </QazinaContext.Provider>
  );
}

export function useQazina(): QazinaContextValue {
  const ctx = useContext(QazinaContext);
  if (!ctx) {
    throw new Error("useQazina must be used inside QazinaProvider");
  }
  return ctx;
}
