import { chromium } from "../frontend/node_modules/playwright-core/index.mjs";
import assert from "node:assert/strict";
import { artifacts, chromiumPath, cleanup } from "./helpers.mjs";
const base = process.env.MOOD_URL || "http://localhost:8088";
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
const username = "reader_" + Date.now().toString(36);
const tile = (title) =>
  page
    .locator(".library-book")
    .filter({
      has: page.locator(".library-book-open>strong", { hasText: title }),
    });
async function nav(name) {
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name, exact: true })
    .click();
}
async function close() {
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
}
try {
  await page.goto(base);
  await page.locator(".post-card").first().waitFor();
  await nav("Библиотека");
  await tile("Чем люди живы").waitFor();
  await tile("Чем люди живы")
    .getByRole("button", { name: "Сохранить книгу", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Присоединиться к Mood" })
    .waitFor();
  await page.getByLabel("Фамилия и имя").fill("Тестов Читатель");
  await page.locator("input[name=username]").fill(username);
  await page.getByLabel("Gmail", { exact: true }).fill(username + "@gmail.com");
  await page.locator("input[name=password]").fill("Mood-test-password-123");
  await page
    .locator(".avatar-upload input")
    .setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: await page.screenshot({
        clip: { x: 0, y: 0, width: 4, height: 4 },
      }),
    });
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await tile("Чем люди живы").waitFor();
  await tile("Чем люди живы")
    .getByRole("button", { name: "Сохранить книгу", exact: true })
    .click();
  await tile("Чем люди живы")
    .getByRole("button", { name: "Убрать книгу из сохранённого", exact: true })
    .waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await tile("Чем люди живы").locator(".library-book-open").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Убрать книгу из сохранённого", exact: true })
    .waitFor();
  await close();
  await tile("Хамелеон").locator(".library-book-open").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить книгу", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Убрать книгу из сохранённого", exact: true })
    .waitFor();
  await close();
  await page
    .getByRole("combobox", { name: "Жанр книги" })
    .selectOption("Наука");
  await page
    .locator(".library-book")
    .filter({ hasText: "История свечи" })
    .waitFor();
  await nav("Лента");
  await page
    .locator(".post-card")
    .first()
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  await page
    .locator(".post-card")
    .first()
    .getByRole("button", { name: "Убрать из сохранённого", exact: true })
    .waitFor();
  await nav("Сохранённое");
  await page.locator(".post-card").first().waitFor();
  await page.getByRole("button", { name: "Книги", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".library-book").length === 2,
  );
  assert.equal(await page.locator(".post-card").count(), 0);
  await tile("Чем люди живы").waitFor();
  await tile("Хамелеон").waitFor();
  await page.screenshot({
    path: artifacts + "saved-books-desktop.png",
    animations: "disabled",
  });
  await page.reload();
  await page.locator(".account").waitFor();
  await nav("Сохранённое");
  await page.getByRole("button", { name: "Книги", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".library-book").length === 2,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: artifacts + "saved-books-mobile.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await tile("Чем люди живы").locator(".library-book-open").click();
  await page.getByRole("button", { name: "Читать книгу", exact: true }).click();
  await page.locator(".reader-body canvas").waitFor();
  await page
    .getByRole("button", { name: "Закрыть книгу", exact: true })
    .click();
  await tile("Хамелеон")
    .getByRole("button", { name: "Убрать книгу из сохранённого", exact: true })
    .click();
  await tile("Хамелеон").waitFor({ state: "hidden" });
  assert.equal(await page.locator(".library-book").count(), 1);
  await page.getByRole("button", { name: "Публикации", exact: true }).click();
  await page.locator(".post-card").first().waitFor();
  assert.equal(await page.locator(".post-card").count(), 1);
  await page.getByRole("button", { name: "Книги", exact: true }).click();
  await tile("Чем люди живы").waitFor();
  await tile("Чем люди живы").locator(".library-book-open").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Убрать книгу из сохранённого", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить книгу", exact: true })
    .waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить книгу", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Убрать книгу из сохранённого", exact: true })
    .waitFor();
  await close();
  await tile("Чем люди живы").waitFor();
  await tile("Чем люди живы")
    .getByRole("button", { name: "Убрать книгу из сохранённого", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Нет сохранённых книг", exact: true })
    .waitFor();
  const response = await context.request.get(base + "/api/books?feed=saved");
  assert.deepEqual(await response.json(), []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: guest gate, book tile and modal saves, separate saved tabs, genre independence, reload persistence, mobile, reading saved PDF, remove/re-save, post bookmarks retained.",
  );
} catch (e) {
  await page.screenshot({
    path: artifacts + "saved-books-failure.png",
    animations: "disabled",
  });
  console.log("ERRORS", errors);
  throw e;
} finally {
  await browser.close();
  if (process.env.MOOD_TEST_CLEANUP === "1") cleanup(username);
}
