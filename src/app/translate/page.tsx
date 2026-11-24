"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  BookOpen,
  Sparkles,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Languages,
  MessageSquareText,
  Send,
  Zap,
  CheckCircle2,
  FileText,
  Loader2,
  X,
  BookMarked,
} from "lucide-react";
import { buildLLMHeaders } from "@/lib/clientStorage";

type ViewMode = "split" | "kk" | "orig";

interface BookState {
  bookId: string;
  title: string;
  totalPages: number;
  freePages: number;
  pages: string[];
  glossary: string;
}

interface TranslatedPage {
  text: string;
  model: string;
  cached: boolean;
}

interface QAMessage {
  role: "user" | "assistant";
  content: string;
  model?: string;
}

const SAMPLE_ILIAD_BOOK: BookState = {
  bookId: "sample_homer_iliad_book1",
  title: "Homer — The Iliad (Book I Trial)",
  totalPages: 4,
  freePages: 2,
  glossary:
    "Achilles — Ахиллес (грек батыры)\nAgamemnon — Агамемнон (Микена патшасы)\nApollo — Аполлон (жарық пен өнер құдайы)\nChryses — Хрис (Аполлон абызы)\nAchaeans — ахейліктер (грек жауынгерлері)\nTroy — Троя (қоршаудағы қала)",
  pages: [
    "Sing, O Muse, of the wrath of Achilles, son of Peleus — a fierce anger that brought countless sorrows upon the Achaean host before the walls of Troy. Many brave warriors fell in battle, and their names echoed across the dusty plain by the ships.",
    "The quarrel began when Agamemnon, commander of the Achaeans, dishonored Chryses, the aged priest of Apollo. Chryses came to the swift ships bearing a golden staff and rich ransom to free his daughter, yet the king dismissed him with harsh words.",
    "In silent grief, Chryses walked along the shore of the loud-roaring sea and prayed to silver-bowed Apollo. Hearing his priest, the god descended from Olympus like night, and his arrows brought a nine-day plague upon the Achaean camp.",
    "On the tenth day, Achilles called the warriors to assembly. Standing before the council, he urged the leaders to seek counsel from a prophet so they might learn why Apollo raged and how the army could be saved from ruin.",
  ],
};

export default function TranslatePage() {
  const [book, setBook] = useState<BookState | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(
    null
  );
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [translations, setTranslations] = useState<
    Record<number, TranslatedPage>
  >({});
  const [translatingPage, setTranslatingPage] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Monetization & 8-stream batch state
  const [unlocked, setUnlocked] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);

  // Glossary & Ask AI state
  const [showGlossary, setShowGlossary] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [qaHistory, setQaHistory] = useState<QAMessage[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Restore unlock state from localStorage per book
  useEffect(() => {
    if (!book) return;
    try {
      const saved = localStorage.getItem(`qazina_unlock_${book.bookId}`);
      setUnlocked(saved === "1");
    } catch {
      setUnlocked(false);
    }
  }, [book]);

  const translateSinglePage = useCallback(
    async (targetBook: BookState, pageNum: number, isUnlocked: boolean) => {
      if (translations[pageNum]) return;
      if (pageNum > targetBook.freePages && !isUnlocked) return;

      const pageText = targetBook.pages[pageNum - 1];
      if (!pageText) return;

      setTranslatingPage(pageNum);
      try {
        const res = await fetch("/api/translate/page", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...buildLLMHeaders(),
          },
          body: JSON.stringify({
            bookId: targetBook.bookId,
            title: targetBook.title,
            pageNumber: pageNum,
            text: pageText,
            prevText:
              pageNum > 1 ? targetBook.pages[pageNum - 2] : undefined,
            unlocked: isUnlocked,
          }),
        });

        const data = await res.json();
        if (res.status === 402 || data.paywall) {
          setShowPaywallModal(true);
          return;
        }
        if (res.ok && data.text) {
          setTranslations((prev) => ({
            ...prev,
            [pageNum]: {
              text: data.text,
              model: data.model || "kazllm",
              cached: Boolean(data.cached),
            },
          }));
          if (data.glossary && !targetBook.glossary) {
            setBook((prev) =>
              prev ? { ...prev, glossary: data.glossary } : prev
            );
          }
        }
      } catch (err) {
        console.error("Translate page error:", err);
      } finally {
        setTranslatingPage((prev) => (prev === pageNum ? null : prev));
      }
    },
    [translations]
  );

  // Auto-translate current page when book/page/unlock changes
  useEffect(() => {
    if (!book) return;
    if (currentPage <= book.freePages || unlocked) {
      void translateSinglePage(book, currentPage, unlocked);
    }
  }, [book, currentPage, unlocked, translateSinglePage]);

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/translate/upload", {
        method: "POST",
        headers: {
          ...buildLLMHeaders(),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "PDF жүктеу кезінде қате шықты.");
        return;
      }

      setBook({
        bookId: data.bookId,
        title: data.title,
        totalPages: data.totalPages,
        freePages: data.freePages ?? 2,
        pages: data.pages,
        glossary: data.glossary || "",
      });
      setTranslations({});
      setQaHistory([]);
      setCurrentPage(1);
      setBatchStatus(null);
    } catch {
      setUploadError("Сервермен байланыс үзілді.");
    } finally {
      setUploading(false);
    }
  };

  const loadSampleBook = () => {
    setUploadError(null);
    setBook(SAMPLE_ILIAD_BOOK);
    setTranslations({});
    setQaHistory([]);
    setCurrentPage(1);
    setBatchStatus(null);
  };

  const goToPage = (next: number) => {
    if (!book) return;
    const clamped = Math.max(1, Math.min(book.totalPages, next));
    if (clamped === currentPage) return;
    setFlipDirection(clamped > currentPage ? "next" : "prev");
    setCurrentPage(clamped);
    setTimeout(() => setFlipDirection(null), 350);
  };

  const handleUnlockDemo = () => {
    if (!book) return;
    try {
      localStorage.setItem(`qazina_unlock_${book.bookId}`, "1");
    } catch {
      // ignore storage errors
    }
    setUnlocked(true);
    setShowPaywallModal(false);
    void translateSinglePage(book, currentPage, true);
  };

  const handleEightStreamBatch = async () => {
    if (!book) return;
    if (!unlocked) {
      setShowPaywallModal(true);
      return;
    }

    const pendingPages = [];
    for (let p = currentPage; p <= book.totalPages && pendingPages.length < 8; p++) {
      if (!translations[p]) {
        pendingPages.push({
          pageNumber: p,
          text: book.pages[p - 1],
          prevText: p > 1 ? book.pages[p - 2] : undefined,
        });
      }
    }

    if (pendingPages.length === 0) {
      setBatchStatus("Келесі 8 бет уже аударылған!");
      return;
    }

    setBatchLoading(true);
    setBatchStatus(`${pendingPages.length} бет 8 ағында қатар аударылуда...`);
    try {
      const res = await fetch("/api/translate/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildLLMHeaders(),
        },
        body: JSON.stringify({
          bookId: book.bookId,
          title: book.title,
          unlocked: true,
          pages: pendingPages,
        }),
      });

      const data = await res.json();
      if (res.status === 402 || data.paywall) {
        setShowPaywallModal(true);
        setBatchStatus(null);
        return;
      }

      if (res.ok && Array.isArray(data.results)) {
        setTranslations((prev) => {
          const next = { ...prev };
          for (const item of data.results) {
            next[item.pageNumber] = {
              text: item.text,
              model: item.model || "kazllm",
              cached: Boolean(item.cached),
            };
          }
          return next;
        });
        setBatchStatus(
          `${data.results.length} бет сәтті аударылып кэштелді!`
        );
      } else {
        setBatchStatus(data.error || "Аударма кезінде қате шықты.");
      }
    } catch {
      setBatchStatus("8 ағынды аударма кезінде қате шықты.");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book || !question.trim() || asking) return;
    const q = question.trim();
    setQuestion("");
    setQaHistory((prev) => [...prev, { role: "user", content: q }]);
    setAsking(true);

    try {
      const pageText = book.pages[currentPage - 1] || "";
      const res = await fetch("/api/translate/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildLLMHeaders(),
        },
        body: JSON.stringify({
          bookTitle: book.title,
          pageText,
          question: q,
        }),
      });
      const data = await res.json();
      setQaHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || data.error || "Жауап алынбады.",
          model: data.model,
        },
      ]);
    } catch {
      setQaHistory((prev) => [
        ...prev,
        { role: "assistant", content: "ИИ-мен байланыс орнату мүмкін болмады." },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const isLockedPage =
    book !== null && currentPage > book.freePages && !unlocked;
  const currentOriginal = book ? book.pages[currentPage - 1] || "" : "";
  const currentTranslation = translations[currentPage];

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            <Languages className="h-3.5 w-3.5" />
            <span>Alem Plus + RAG Глоссарий</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-100 sm:text-3xl">
            PDF Кітапты Қазақшаға ИИ Аударма
          </h1>
          <p className="mt-1 text-sm text-stone-400">
            Кітапты PDF-пен жүктеңіз — алғашқы 2 беті тегін аударылады, ал
            түсінбеген жеріңізді ИИ-дан сұрай аласыз.
          </p>
        </div>

        {book && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-xs font-medium text-stone-200 transition hover:border-amber-500/50 hover:text-amber-300"
            >
              <Upload className="h-3.5 w-3.5" />
              Басқа PDF
            </button>
            <button
              type="button"
              onClick={() => setShowGlossary((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-xs font-medium text-stone-200 transition hover:border-amber-500/50 hover:text-amber-300"
            >
              <BookMarked className="h-3.5 w-3.5" />
              Глоссарий (RAG)
            </button>
            {unlocked ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
                <Unlock className="h-3.5 w-3.5" />
                Pro ашық
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowPaywallModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-stone-950 transition hover:bg-amber-400"
              >
                <Lock className="h-3.5 w-3.5" />
                Толық аударма (Pro)
              </button>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFileUpload(f);
          e.target.value = "";
        }}
      />

      {/* Empty / Upload State */}
      {!book && (
        <div className="grid gap-5 lg:grid-cols-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFileUpload(f);
            }}
            className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-700/80 bg-stone-900/60 p-8 text-center transition hover:border-amber-500/60 lg:col-span-3"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
              {uploading ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <Upload className="h-7 w-7" />
              )}
            </div>
            <h2 className="text-lg font-semibold text-stone-100">
              {uploading ? "PDF оқылып, глоссарий жасалуда..." : "PDF кітапты жүктеңіз"}
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-stone-400">
              Ағылшын, орыс немесе басқа тілдегі кітапты салыңыз (30 МБ дейін).
              Алғашқы 2 беті тегін қазақшаланады.
            </p>
            {uploadError && (
              <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {uploadError}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60"
              >
                <FileText className="h-4 w-4" />
                PDF таңдау
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={loadSampleBook}
                className="inline-flex items-center gap-2 rounded-2xl border border-stone-700 bg-stone-800/80 px-5 py-2.5 text-sm font-medium text-stone-200 transition hover:border-amber-500/50 hover:text-amber-300"
              >
                <Sparkles className="h-4 w-4 text-amber-400" />
                Гомер «Илиада» (1-ретті сынау)
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-stone-800 bg-stone-900/50 p-6 lg:col-span-2">
            <div>
              <h3 className="text-base font-semibold text-stone-100">
                Қалай жұмыс істейді?
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-stone-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>1–2 бет тегін (Сынақ):</strong> Аударма сапасын
                    көру үшін алғашқы 2 бет толық тегін аударылады.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>RAG Глоссарий:</strong> Кейіпкер есімдері мен
                    терминдер кітап бойы біркелкі сақталады.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>8 ағынды аударма:</strong> Pro ашылғанда келесі 8
                    бет қатар аударылып, кэштеледі.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>ИИ-дан сұрау:</strong> Түсініксіз сөйлем немесе
                    сөздің мағынасын дәл сол беттен сұрап біліңіз.
                  </span>
                </li>
              </ul>
            </div>
            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-stone-400">
              Тариф: <strong className="text-amber-300">490 ₸ / кітап</strong>{" "}
              немесе <strong className="text-amber-300">1 490 ₸ / ай Pro</strong>
            </div>
          </div>
        </div>
      )}

      {/* Active Reader */}
      {book && (
        <div className="space-y-5">
          {/* Glossary Drawer */}
          {showGlossary && (
            <div className="rounded-2xl border border-amber-500/30 bg-stone-900/90 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  RAG Терминдер мен кейіпкерлер сөздігі
                </span>
                <button
                  type="button"
                  onClick={() => setShowGlossary(false)}
                  className="text-stone-400 hover:text-stone-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-stone-300">
                {book.glossary || "Глоссарий дайындалуда..."}
              </pre>
            </div>
          )}

          {/* Controls Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-stone-800 bg-stone-900/80 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-4 w-4 shrink-0 text-amber-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-100">
                  {book.title}
                </p>
                <p className="text-xs text-stone-400">
                  {currentPage}-бет / {book.totalPages}-бет{" "}
                  {currentPage <= book.freePages ? (
                    <span className="text-emerald-400">• Тегін сынақ беті</span>
                  ) : unlocked ? (
                    <span className="text-amber-300">• Pro ашық</span>
                  ) : (
                    <span className="text-rose-400">• Ақылы бет</span>
                  )}
                </p>
              </div>
            </div>

            {/* View mode tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-stone-800 bg-stone-950 p-1 text-xs">
                {(
                  [
                    { id: "split", label: "Екеуі қатар" },
                    { id: "kk", label: "Қазақша (AI)" },
                    { id: "orig", label: "Түпнұсқа" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setViewMode(tab.id)}
                    className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                      viewMode === tab.id
                        ? "bg-amber-500 text-stone-950"
                        : "text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={batchLoading}
                onClick={handleEightStreamBatch}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-50"
              >
                {batchLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                8 ағынды аударма
              </button>
            </div>
          </div>

          {batchStatus && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
              {batchStatus}
            </div>
          )}

          {/* 3D Book Page Stage */}
          <div className="book-3d-stage">
            <div
              className={`book-page-stack rounded-3xl border border-stone-800 bg-stone-900/90 p-4 sm:p-7 ${
                flipDirection === "next"
                  ? "animate-page-next"
                  : flipDirection === "prev"
                  ? "animate-page-prev"
                  : ""
              }`}
            >
              <div
                className={`grid gap-6 ${
                  viewMode === "split" ? "md:grid-cols-2" : "grid-cols-1"
                }`}
              >
                {/* Original Text */}
                {(viewMode === "split" || viewMode === "orig") && (
                  <div className="rounded-2xl border border-stone-800/80 bg-stone-950/60 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between border-b border-stone-800 pb-2 text-xs text-stone-400">
                      <span className="font-medium text-stone-300">
                        Түпнұсқа мәтін
                      </span>
                      <span>{currentPage}-бет</span>
                    </div>
                    <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-stone-200 sm:text-base">
                      {currentOriginal}
                    </p>
                  </div>
                )}

                {/* Kazakh Translation OR Paywall */}
                {(viewMode === "split" || viewMode === "kk") && (
                  <div className="rounded-2xl border border-amber-500/20 bg-stone-950/80 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between border-b border-stone-800 pb-2 text-xs text-stone-400">
                      <span className="font-medium text-amber-300">
                        Қазақша аударма (AI)
                      </span>
                      {currentTranslation && (
                        <span className="rounded-md bg-stone-800 px-2 py-0.5 text-[11px] text-stone-300">
                          {currentTranslation.model}
                          {currentTranslation.cached ? " • кэш" : ""}
                        </span>
                      )}
                    </div>

                    {isLockedPage ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                          <Lock className="h-6 w-6" />
                        </div>
                        <h3 className="text-base font-semibold text-stone-100">
                          Алғашқы {book.freePages} тегін бет аяқталды
                        </h3>
                        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-stone-400">
                          Қалған {book.totalPages - book.freePages} бетті RAG
                          глоссариймен және 8 ағынды жылдам аудармамен оқу үшін
                          кітапты ашыңыз.
                        </p>
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowPaywallModal(true)}
                            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-stone-950 transition hover:bg-amber-400"
                          >
                            Толық кітапты ашу — 490 ₸
                          </button>
                          <button
                            type="button"
                            onClick={handleUnlockDemo}
                            className="rounded-xl border border-stone-700 bg-stone-800 px-4 py-2 text-xs font-medium text-stone-200 transition hover:border-amber-500/50"
                          >
                            Демо режиммен ашу
                          </button>
                        </div>
                      </div>
                    ) : translatingPage === currentPage &&
                      !currentTranslation ? (
                      <div className="flex flex-col items-center justify-center py-12 text-stone-400">
                        <Loader2 className="mb-2 h-6 w-6 animate-spin text-amber-400" />
                        <span className="text-xs">
                          Қазақшаға көркем аударылуда...
                        </span>
                      </div>
                    ) : currentTranslation ? (
                      <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-stone-100 sm:text-base">
                        {currentTranslation.text}
                      </p>
                    ) : (
                      <div className="py-10 text-center text-xs text-stone-400">
                        Аударма күтілуде...
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className="mt-5 flex items-center justify-between border-t border-stone-800 pt-4">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-800/80 px-3.5 py-2 text-xs font-medium text-stone-200 transition hover:border-amber-500/50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Алдыңғы бет
                </button>

                <span className="text-xs font-medium text-stone-400">
                  {currentPage} / {book.totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= book.totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-800/80 px-3.5 py-2 text-xs font-medium text-stone-200 transition hover:border-amber-500/50 disabled:opacity-40"
                >
                  Келесі бет
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Ask AI Panel */}
          <div className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4 sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-stone-100">
                Түсінбеген жерімді ИИ-дан сұрау ({currentPage}-бет бойынша)
              </h3>
            </div>

            {qaHistory.length > 0 && (
              <div className="mb-4 max-h-64 space-y-2.5 overflow-y-auto pr-1">
                {qaHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed sm:text-sm ${
                      msg.role === "user"
                        ? "ml-auto max-w-[85%] bg-amber-500/15 text-amber-100"
                        : "mr-auto max-w-[90%] border border-stone-800 bg-stone-950/80 text-stone-200"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAskAI} className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Мысалы: «wrath» сөзі бұл контексте қандай мағына береді?"
                className="min-w-0 flex-1 rounded-xl border border-stone-700 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none sm:text-sm"
              />
              <button
                type="submit"
                disabled={asking || !question.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {asking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Сұрау</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Paywall Modal */}
      {showPaywallModal && book && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-stone-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                <Lock className="h-5 w-5" />
              </div>
              <button
                type="button"
                onClick={() => setShowPaywallModal(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <h3 className="mt-4 text-lg font-bold text-stone-100">
              Толық кітапты қазақшалау (Pro)
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-400">
              «{book.title}» кітабының алғашқы {book.freePages} беті тегін
              берілді. Барлық {book.totalPages} бетті 8 ағында аудару үшін
              тарифті таңдаңыз:
            </p>

            <div className="mt-4 space-y-2.5">
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-100">
                    Бір кітапты толық ашу
                  </span>
                  <span className="text-sm font-bold text-amber-300">
                    490 ₸
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-400">
                  Барлық беттер + RAG сөздік + ИИ түсіндіру
                </p>
              </div>

              <div className="rounded-2xl border border-stone-700 bg-stone-950/60 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-100">
                    QAZINA Pro (Айлық)
                  </span>
                  <span className="text-sm font-bold text-stone-200">
                    1 490 ₸ / ай
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-400">
                  Шексіз PDF кітаптар және 8 ағынды жылдам аударма
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleUnlockDemo}
                className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-400"
              >
                Төлемді растау (Демо-ашу)
              </button>
              <button
                type="button"
                onClick={() => setShowPaywallModal(false)}
                className="w-full rounded-2xl border border-stone-700 py-2.5 text-xs font-medium text-stone-300 hover:bg-stone-800"
              >
                Кейінірек
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
