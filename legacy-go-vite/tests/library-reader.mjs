import { chromium } from "../frontend/node_modules/playwright-core/index.mjs";
import assert from "node:assert/strict";
import { artifacts, chromiumPath } from "./helpers.mjs";
const base = process.env.MOOD_URL || "http://localhost:8088";
const browser = await chromium.launch({
  headless: true,
  executablePath: chromiumPath,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const consoleErrors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
try {
  await page.goto(base);
  await page.locator(".post-card").first().waitFor();
  await page.locator(".discovery-book").first().waitFor();
  const desktop = await page.locator(".main-panel").boundingBox();
  assert.ok(desktop.width > 740, "Desktop feed should use a wide viewport");
  assert.equal(await page.locator(".discovery-sidebar").isVisible(), true);
  await page.screenshot({
    path: artifacts + "desktop-library-feed.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Наука", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".post-card").length > 0 &&
      [...document.querySelectorAll(".quote-book")].every((e) =>
        e.textContent.includes("свечи"),
      ),
  );
  assert.ok((await page.locator(".post-card").count()) >= 3);
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "Библиотека", exact: true })
    .click();
  await page.locator(".library-book").first().waitFor();
  const books = await (await page.request.get(base + "/api/books")).json();
  const full = books.filter((b) => b.source_url);
  assert.equal(full.length, 8);
  assert.ok(full.every((b) => b.pages > 1 && b.file));
  const book = full.find((b) => b.title === "Чем люди живы");
  await page.locator(".library-book").filter({ hasText: book.title }).click();
  await page.getByRole("button", { name: "Читать книгу", exact: true }).click();
  await page.locator(".reader-body canvas").waitFor({ timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelector(".reader-body canvas")?.width > 300,
  );
  assert.equal(await page.locator(".react-pdf__Page__textContent").count(), 0);
  assert.equal(await page.locator(".react-pdf__Page__annotations").count(), 0);
  await page.getByRole("button", { name: "Следующая страница" }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "Страница книги" }).inputValue(),
    "2",
  );
  await page.locator(".reader-body canvas").waitFor();
  await page.screenshot({
    path: artifacts + "reader-desktop.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Увеличить", exact: true }).click();
  await page.getByRole("button", { name: "Сбросить масштаб" }).click();
  await page
    .getByRole("textbox", { name: "Страница книги" })
    .fill(String(book.pages));
  await page.getByRole("textbox", { name: "Страница книги" }).press("Enter");
  assert.equal(
    await page.getByRole("textbox", { name: "Страница книги" }).inputValue(),
    String(book.pages),
  );
  await page.getByRole("button", { name: "Закрыть книгу" }).click();
  await page.locator(".library-book").filter({ hasText: book.title }).click();
  await page.getByRole("button", { name: "Читать книгу", exact: true }).click();
  await page.locator(".reader-body canvas").waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Страница книги" }).inputValue(),
    String(book.pages),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const c = document.querySelector(".reader-body canvas");
    const b = document.querySelector(".reader-body");
    return (
      c &&
      b &&
      c.getBoundingClientRect().width <= b.getBoundingClientRect().width
    );
  });
  await page.getByRole("textbox", { name: "Страница книги" }).fill("2");
  await page.getByRole("textbox", { name: "Страница книги" }).press("Enter");
  await page.locator(".reader-body canvas").waitFor();
  await page.screenshot({
    path: artifacts + "reader-mobile.png",
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Закрыть книгу" }).click();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Лента", exact: true })
    .click();
  await page.locator(".post-card").first().waitFor();
  for (const width of [320, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `No document overflow at ${width}`,
    );
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  console.log(
    "PASS: eight complete books, desktop width, topic feed, PDF rendering, page navigation, zoom, resume, mobile reading, responsive viewports.",
  );
} catch (e) {
  await page.screenshot({
    path: artifacts + "reader-failure.png",
    animations: "disabled",
  });
  console.log("PAGE ERRORS", errors, "CONSOLE ERRORS", consoleErrors);
  throw e;
} finally {
  await browser.close();
}
