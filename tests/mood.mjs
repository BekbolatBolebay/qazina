import { chromium } from "../frontend/node_modules/playwright-core/index.mjs";
import assert from "node:assert/strict";
import { artifacts, chromiumPath } from "./helpers.mjs";
const base = process.env.MOOD_URL || "http://localhost:8088";

// Подбор по эмоции требует доступный LLM-провайдер (или сработает
// детерминированный fallback). Сценарий валидирует контракт UI.
const status = await fetch(base + "/api/mood/status")
  .then((r) => r.json())
  .catch(() => ({ available: false }));
if (!status.available) {
  console.log("SKIP: LLM-провайдер недоступен, сценарий подбора по эмоции пропущен");
  process.exit(0);
}
const browser = await chromium.launch({
  headless: true,
  executablePath: chromiumPath,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base);
  await page.locator(".post-card").first().waitFor();
  const emotion = "одиноко в толпе, хочется, чтобы кто-то меня понял";
  await page.getByLabel("Эмоция или состояние").fill(emotion);
  await page
    .locator(".mood-card")
    .getByRole("button", { name: /Подобрать 3 книг/ })
    .click();
  // Первая книга появляется сразу, как готова её цитата; остальные — потоком.
  await page.locator(".mood-books li").first().waitFor({ timeout: 180000 });
  await page
    .locator(".mood-summary")
    .filter({ hasText: emotion })
    .waitFor({ timeout: 5000 });
  // Остальные две подтягиваются сразу за первой.
  await page.locator(".mood-books li").nth(2).waitFor({ timeout: 120000 });
  const books = page.locator(".mood-books li");
  assert.equal(await books.count(), 3, "подбор должен вернуть ровно 3 книги");
  const seen = new Set();
  for (let i = 0; i < 3; i++) {
    const item = books.nth(i);
    const title = (await item.locator(".mood-text strong").innerText()).trim();
    const why = (await item.locator(".mood-why").innerText()).trim();
    assert.ok(title.length > 0, "у книги должен быть заголовок");
    assert.ok(why.length > 10, "у каждой книги должна быть причина подбора");
    assert.ok(!seen.has(title), "книги в подборе должны быть разными");
    seen.add(title);
    // Интригующий текст из книги со страницей.
    const excerpt = item.locator(".mood-excerpt");
    assert.equal(await excerpt.count(), 1, "у каждой книги должен быть отрывок из текста");
    const excerptText = (await excerpt.innerText()).trim();
    assert.ok(/стр\. \d+/.test(excerptText), "у отрывка должна быть страница");
    assert.ok(excerptText.length > 40, "отрывок не должен быть пустым");
    // В карточке — обложка (без превью страниц).
    assert.equal(
      await item.locator(".book-cover").count(),
      1,
      "в карточке должна быть обложка",
    );
    assert.equal(
      await item.locator(".mood-page-frame").count(),
      0,
      "превью страницы в карточке не должно быть",
    );
  }
  await page.screenshot({ path: artifacts + "mood-match.png", animations: "disabled" });
  // «Читать» открывает ридер с той страницы, на которой цитата.
  const firstExcerpt = await books
    .first()
    .locator(".mood-excerpt span")
    .innerText();
  const pageMatch = firstExcerpt.trim().match(/стр\. (\d+)/);
  assert.ok(pageMatch, "у отрывка первой книги должна быть страница");
  await books.first().locator(".mood-read-btn").click();
  await page.locator(".reader-shell").waitFor({ timeout: 30000 });
  await page
    .locator(".reader-body canvas, .reader-body .text-page")
    .first()
    .waitFor({ timeout: 60000 });
  const input = page.getByLabel("Страница книги");
  await input.waitFor({ timeout: 10000 });
  assert.equal(
    (await input.inputValue()).trim(),
    pageMatch[1],
    "чтение должно начинаться с страницы отрывка",
  );
  await page.screenshot({ path: artifacts + "mood-reader-start.png", animations: "disabled" });
  console.log(
    "OK: подбор по эмоции — 3 книги: обложка + интригующая цитата со страницей, «Читать» стартует с этой страницы",
  );
} finally {
  if (errors.length) throw new Error("page errors: " + errors.join(" | "));
  await browser.close();
}
