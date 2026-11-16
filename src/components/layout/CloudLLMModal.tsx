"use client";

import React, { useState } from "react";
import { CheckCircle2, Cloud, KeyRound, Loader2, X, ZapOff } from "lucide-react";
import { useQazina } from "./QazinaProvider";

const PRESETS = [
  {
    name: "Alem Plus · Qwen 3.8",
    apiUrl: "https://llm.alem.ai/v1/chat/completions",
    model: "qwen3-8",
  },
  {
    name: "Alem Plus · KazLLM",
    apiUrl: "https://llm.alem.ai/v1/chat/completions",
    model: "kazllm",
  },
  {
    name: "Alem Plus · Gemma 4",
    apiUrl: "https://llm.alem.ai/v1/chat/completions",
    model: "gemma4",
  },
  {
    name: "Ollama Cloud",
    apiUrl: "https://ollama.com/api/chat",
    model: "gpt-oss:20b-cloud",
  },
];

export function CloudLLMModal() {
  const {
    llmModalOpen,
    setLlmModalOpen,
    llmSettings,
    updateLLMSettings,
    llmStatus,
    refreshLLMStatus,
    showToast,
  } = useQazina();

  const [apiUrl, setApiUrl] = useState(llmSettings.apiUrl);
  const [apiKey, setApiKey] = useState(llmSettings.apiKey);
  const [model, setModel] = useState(llmSettings.model);
  const [testing, setTesting] = useState(false);

  if (!llmModalOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setTesting(true);
    const next = {
      apiUrl: apiUrl.trim(),
      apiKey: apiKey.trim(),
      model: model.trim() || "gpt-oss",
    };
    updateLLMSettings(next);
    const status = await refreshLLMStatus(next);
    setTesting(false);
    if (status.reachable) {
      showToast(`Cloud AI қосылды (${status.model})`);
      setLlmModalOpen(false);
    } else if (!next.apiKey && !status.configured) {
      showToast("Offline MVP режимі белсенді (API кілтінсіз жұмыс істейді)");
      setLlmModalOpen(false);
    } else {
      showToast("Баптау сақталды — провайдер жауап бермеді, сұраныс кезінде fallback қосылады");
    }
  }

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Cloud LLM API баптаулары"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#EFE8DD] bg-white p-6 shadow-xl dark:border-[#2C3733] dark:bg-[#1D2421]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#173F35] dark:text-[#F3EFE7]">
              <Cloud size={20} className="text-[#B58B54]" />
              Бұлттық LLM API баптауы
            </h2>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
              AlemLLM, Ollama Cloud немесе кез келген OpenAI-үйлесімді API кілтін енгізіңіз.
              Кілтсіз де QAZINA толық Offline MVP режимінде істейді.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLlmModalOpen(false)}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-[#EFE8DD] dark:hover:bg-[#26302C]"
            aria-label="Жабу"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 space-y-2 rounded-xl bg-[#F8F5EF] px-3.5 py-2.5 text-xs dark:bg-[#141917]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              {llmStatus.reachable ? (
                <>
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Бұлттық AI белсенді ({llmStatus.model})</span>
                </>
              ) : llmStatus.configured ? (
                <>
                  <ZapOff size={16} className="text-amber-600" />
                  <span>API кілті бар, провайдер тексерілуде ({llmStatus.model})</span>
                </>
              ) : (
                <>
                  <ZapOff size={16} className="text-[#B58B54]" />
                  <span>Offline MVP режимі (қауіпсіз детерминистік алгоритм)</span>
                </>
              )}
            </span>
            <span className="rounded bg-[#EFE8DD] px-2 py-0.5 text-[11px] font-semibold uppercase text-[#173F35] dark:bg-[#26302C] dark:text-[#D4B382]">
              {llmStatus.provider}
            </span>
          </div>
          {llmStatus.services && llmStatus.services.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {llmStatus.services.map((srv) => (
                <span
                  key={srv}
                  className="rounded-md bg-emerald-600/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300"
                >
                  ✓ {srv}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4">
          <p className="mb-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            Дайын провайдер үлгілері:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setApiUrl(p.apiUrl);
                  setModel(p.model);
                }}
                className="rounded-lg border border-[#EFE8DD] bg-[#F8F5EF] px-2.5 py-1 text-xs font-medium text-[#173F35] transition hover:border-[#B58B54] dark:border-[#2C3733] dark:bg-[#141917] dark:text-[#D4B382]"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold">API Endpoint URL</label>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://llm.alem.ai/chat/completions"
              className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3 py-2 text-sm outline-none focus:border-[#173F35] dark:border-[#2C3733] dark:bg-[#141917]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">Model Name</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-oss"
              className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3 py-2 text-sm outline-none focus:border-[#173F35] dark:border-[#2C3733] dark:bg-[#141917]"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
              <KeyRound size={13} className="text-[#B58B54]" />
              API Key (тек осы браузерде сақталады немесе .env.local ішіне қойылады)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... немесе бос қалдырыңыз"
              className="w-full rounded-xl border border-[#EFE8DD] bg-[#F8F5EF] px-3 py-2 text-sm outline-none focus:border-[#173F35] dark:border-[#2C3733] dark:bg-[#141917]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setLlmModalOpen(false)}
              className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-[#EFE8DD] dark:text-neutral-300 dark:hover:bg-[#26302C]"
            >
              Болдырмау
            </button>
            <button
              type="submit"
              disabled={testing}
              className="inline-flex items-center gap-2 rounded-xl bg-[#173F35] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#112F28] disabled:opacity-60"
            >
              {testing && <Loader2 size={15} className="animate-spin" />}
              Сақтау және тексеру
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
