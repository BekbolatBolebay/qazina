import type { Book, MoodExcerpt } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch("/api" + path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data = await res
    .json()
    .catch(() => ({ error: "Сервис недоступен. Попробуйте ещё раз." }));
  if (!res.ok)
    throw new ApiError(data.error || "Не удалось выполнить запрос", res.status);
  return data as T;
}
// uploadBook шлёт книгу на сервер с прогрессом загрузки (XHR, fetch его не даёт).
export function uploadBook(
  formData: FormData,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ id: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/books");
    xhr.responseType = "json";
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((xhr.response ?? { id: 0 }) as { id: number });
        return;
      }
      const data = (xhr.response ?? {}) as { error?: string };
      reject(
        new ApiError(data.error || "Не удалось добавить книгу", xhr.status),
      );
    };
    xhr.onerror = () =>
      reject(new ApiError("Сервис недоступен. Попробуйте ещё раз.", 0));
    xhr.send(formData);
  });
}
// moodStream читает подбор по эмоции потоком (SSE): резюме, затем каждая
// книга по мере готовности (первая появляется раньше остальных).
export interface MoodBookEvent {
  position: number;
  book: Book;
  why: string;
  excerpt?: MoodExcerpt;
}
export async function moodStream(
  emotion: string,
  handlers: {
    onSummary: (data: { emotion: string; summary: string }) => void;
    onBook: (data: MoodBookEvent) => void;
    onDone: () => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/mood/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emotion }),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res
      .json()
      .catch(() => ({ error: "Не удалось подобрать книги" }));
    throw new ApiError(data.error || "Не удалось подобрать книги", res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;
      let payload: any;
      try {
        payload = JSON.parse(dataLines.join("\n"));
      } catch {
        continue;
      }
      switch (event) {
        case "summary":
          handlers.onSummary(payload);
          break;
        case "book":
          handlers.onBook(payload);
          break;
        case "done":
          handlers.onDone();
          break;
        case "error":
          handlers.onError(payload.error || "Не удалось подобрать книги");
          break;
      }
    }
  }
}
export function relativeTime(value: string) {
  const minutes = Math.max(
    1,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes} мин.`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} ч.`;
  return new Date(value).toLocaleDateString("ru", {
    day: "numeric",
    month: "short",
  });
}
