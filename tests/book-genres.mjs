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
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base);
  await page.locator(".post-card").first().waitFor();
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "Библиотека", exact: true })
    .click();
  await page.locator(".library-book").first().waitFor();
  const totalBooks = (
    await (await fetch(base + "/api/books")).json()
  ).length;
  const scienceBooks = (
    await (
      await fetch(base + "/api/books?genre=" + encodeURIComponent("Наука"))
    ).json()
  ).length;
  const philosophyBooks = (
    await (
      await fetch(
        base + "/api/books?genre=" + encodeURIComponent("Философия"),
      )
    ).json()
  ).length;
  assert.ok(scienceBooks > 0, "в жанре «Наука» есть книги");
  await page
    .getByRole("combobox", { name: "Жанр книги" })
    .selectOption("Наука");
  await page.waitForFunction(
    (count) =>
      document.querySelectorAll(".library-book").length === count &&
      [...document.querySelectorAll(".library-book")].some((el) =>
        el.textContent.includes("История свечи"),
      ),
    scienceBooks,
  );
  const search = page.getByRole("textbox", { name: "Поиск в библиотеке" });
  await search.fill("Достоевский");
  await search.press("Enter");
  await page.getByRole("heading", { name: "Пока ничего не найдено" }).waitFor();
  await search.fill("Фарадей");
  await search.press("Enter");
  await page
    .locator(".library-book")
    .filter({ hasText: "История свечи" })
    .waitFor();
  await page
    .getByRole("combobox", { name: "Жанр книги" })
    .selectOption("Философия");
  await page.getByRole("heading", { name: "Пока ничего не найдено" }).waitFor();
  await search.fill("");
  await search.press("Enter");
  await page.waitForFunction(
    (count) => document.querySelectorAll(".library-book").length === count,
    philosophyBooks,
  );
  assert.ok(
    (await page.locator(".library-book").allTextContents()).every((t) =>
      t.includes("Философия"),
    ),
  );
  await page.getByRole("combobox", { name: "Жанр книги" }).selectOption("");
  await page.waitForFunction(
    (total) => document.querySelectorAll(".library-book").length === total,
    totalBooks,
  );
  await page.screenshot({
    path: artifacts + "book-genres-desktop.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("combobox", { name: "Жанр книги" })
    .selectOption("Наука");
  await page.waitForFunction(
    (count) => document.querySelectorAll(".library-book").length === count,
    scienceBooks,
  );
  await page.screenshot({
    path: artifacts + "book-genres-mobile.png",
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: genre selection, combined author search, empty results, reset to all books, mobile layout.",
  );
} catch (e) {
  await page.screenshot({
    path: artifacts + "book-genres-failure.png",
    animations: "disabled",
  });
  throw e;
} finally {
  await browser.close();
}
