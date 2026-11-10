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
  const books = await (await page.request.get(base + "/api/books")).json();
  const catalogue = books.filter((b) => b.cover_source);
  assert.equal(catalogue.length, 13);
  assert.ok(catalogue.every((b) => b.cover && b.cover_edition));
  const firstPosts = await (await page.request.get(base + "/api/posts")).json();
  const first = firstPosts[0];
  await page
    .locator(".post-card")
    .first()
    .getByRole("button", { name: "Комментарии", exact: true })
    .click();
  await page.waitForURL(`**/?post=${first.id}`);
  await page
    .getByRole("heading", { name: "Комментарии", exact: true })
    .waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.locator(".comment").first().waitFor();
  assert.ok((await page.locator(".comment").count()) > 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Войти, чтобы ответить" })
      .isVisible(),
    true,
  );
  const postBox = await page.locator(".post-thread>.post-card").boundingBox();
  const commentsBox = await page.locator(".thread-comments").boundingBox();
  assert.ok(
    commentsBox.y >= postBox.y + postBox.height - 1,
    "Comments appear below post",
  );
  await page.screenshot({
    path: artifacts + "post-detail-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Войти, чтобы ответить" }).click();
  await page.getByRole("heading", { name: "Вход", exact: true }).waitFor();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.reload();
  await page
    .getByRole("heading", { name: "Комментарии", exact: true })
    .waitFor();
  await page.locator(".comment").first().waitFor();
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await page.waitForURL(base + "/");
  await page.locator(".post-card").nth(1).waitFor();
  await page.locator(".post-card").nth(1).locator(".opinion").click();
  await page.waitForFunction(() =>
    new URLSearchParams(location.search).has("post"),
  );
  await page.locator(".thread-comments").waitFor();
  await page.goBack();
  await page.waitForURL(base + "/");
  await page.locator(".post-card").nth(1).waitFor();
  await page.goForward();
  await page.locator(".thread-comments").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: artifacts + "post-detail-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Библиотека", exact: true })
    .click();
  await page.waitForURL(base + "/");
  await page.locator(".library-book").first().waitFor();
  await page.locator(".library-book").last().scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".library-book .book-cover img")].every(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
  await page.screenshot({
    path: artifacts + "real-covers-library.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator(".library-book")
    .filter({ hasText: "Чем люди живы" })
    .click();
  await page.locator(".cover-credit").waitFor();
  await page.getByRole("button", { name: "Читать книгу", exact: true }).click();
  await page.locator(".reader-body canvas").waitFor();
  await page.getByRole("button", { name: "Закрыть книгу" }).click();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 13 real cover files, attribution, guest-readable post detail, inline comments, login for replies, refresh, back/forward, mobile layout, PDF reader.",
  );
} catch (e) {
  await page.screenshot({
    path: artifacts + "post-detail-failure.png",
    animations: "disabled",
  });
  console.log("ERRORS", errors);
  throw e;
} finally {
  await browser.close();
}
