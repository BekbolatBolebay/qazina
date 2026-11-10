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
const stamp = Date.now().toString(36);
const username = "reader_" + stamp;
const title = "Книга " + stamp;
console.log("Test fixture:", username, title);
async function closeModal() {
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
}
try {
  await page.goto(base);
  await page.locator(".post-card").first().waitFor();
  assert.ok((await page.locator(".post-card").count()) >= 3);
  // Every protected affordance is a registration gate for a visitor.
  for (const label of ["Нравится", "Поделиться", "Сохранить"]) {
    await page
      .locator(".post-card")
      .first()
      .getByRole("button", { name: label, exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Присоединиться к Mood" })
      .waitFor();
    await closeModal();
  }
  await page.locator(".profile-link").first().click();
  await page
    .getByRole("heading", { name: "Присоединиться к Mood" })
    .waitFor();
  await closeModal();
  await page.getByRole("button", { name: "Создать пост", exact: true }).click();
  await page
    .getByRole("heading", { name: "Присоединиться к Mood" })
    .waitFor();
  await page.getByLabel("Фамилия и имя").fill("Тестов Читатель");
  await page.locator("input[name=username]").fill(username);
  await page.getByLabel("Gmail", { exact: true }).fill(username + "@gmail.com");
  await page.locator("input[name=password]").fill("Mood-test-password-123");
  await page.locator(".avatar-upload input").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: await page.screenshot({
      clip: { x: 0, y: 0, width: 4, height: 4 },
    }),
  });
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Присоединиться к Mood" })
    .waitFor({ state: "hidden" });
  await page.reload();
  await page.locator(".account").waitFor();
  // Upload and then reject the same title/author, including a real PDF attachment.
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "Библиотека", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Добавить книгу", exact: true })
    .click();
  await page.getByLabel("Название", { exact: true }).fill(title);
  await page.getByLabel("Автор", { exact: true }).fill("Тестовый Автор");
  await page.locator("input[name=file]").setInputFiles({
    name: "book.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(
      `%PDF-1.4\n% ${stamp}\n1 0 obj<</Type/Catalog>>endobj\n%%EOF`,
    ),
  });
  await page
    .getByRole("button", { name: "Добавить в библиотеку", exact: true })
    .click();
  await page.locator(".library-book").filter({ hasText: title }).waitFor();
  await page
    .getByRole("button", { name: "Добавить книгу", exact: true })
    .click();
  await page.getByLabel("Название", { exact: true }).fill(title);
  await page.getByLabel("Автор", { exact: true }).fill("Тестовый Автор");
  await page
    .getByRole("button", { name: "Добавить в библиотеку", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Эта книга уже есть" })
    .waitFor();
  await closeModal();
  await page.locator(".library-book").filter({ hasText: title }).click();
  await page
    .getByRole("button", { name: "Поблагодарить", exact: false })
    .click();
  await page.getByRole("button", { name: "1 · Поблагодарить" }).waitFor();
  await page.getByRole("link", { name: "Скачать PDF" }).waitFor();
  await page.getByRole("button", { name: "Написать об этой книге" }).click();
  await page
    .locator("textarea[name=quote]")
    .fill("У каждой истории есть свой читатель.");
  await page.locator("input[name=page]").fill("42");
  await page.locator("input[name=lines]").fill("7–9");
  await page
    .locator("textarea[name=opinion]")
    .fill("Это моё отдельное мнение, а не часть цитаты.");
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  const post = page.locator(".post-card").first();
  await post
    .getByText("Это моё отдельное мнение, а не часть цитаты.", { exact: true })
    .waitFor();
  assert.equal(
    await post.locator("blockquote").textContent(),
    "У каждой истории есть свой читатель.",
  );
  await post.getByRole("button", { name: "Нравится", exact: true }).click();
  await post.getByRole("button", { name: "Убрать лайк" }).waitFor();
  await post.getByRole("button", { name: "Сохранить", exact: true }).click();
  await post.getByRole("button", { name: "Убрать из сохранённого" }).waitFor();
  await post.getByRole("button", { name: "Комментарии", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Ваш комментарий" })
    .fill("Разговор продолжается.");
  await page.getByRole("button", { name: "Отправить комментарий" }).click();
  await page.getByText("Разговор продолжается.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await page.waitForFunction(
    () => !new URLSearchParams(location.search).has("post"),
  );
  await page.reload();
  await page
    .locator(".post-card")
    .first()
    .getByRole("button", { name: "Убрать лайк" })
    .waitFor();
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "Сохранённое", exact: true })
    .click();
  await page
    .getByText("Это моё отдельное мнение, а не часть цитаты.", { exact: true })
    .waitFor();
  // A new reply must not move the pagination cursor past unloaded comments.
  if (process.env.MOOD_TEST_PAGINATION === "1") {
    const response = await context.request.get(base + "/api/posts");
    const latest = (await response.json())[0];
    for (let n = 1; n <= 51; n++) {
      const result = await context.request.post(
        `${base}/api/posts/${latest.id}/comments`,
        { data: { body: `Комментарий для пагинации ${n}` } },
      );
      assert.equal(result.status(), 201);
    }
    await page
      .locator(".desktop-nav")
      .getByRole("button", { name: "Лента", exact: true })
      .click();
    await page
      .locator(".post-card")
      .first()
      .getByRole("button", { name: "Комментарии", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll(".comment").length === 50,
    );
    await page
      .getByRole("textbox", { name: "Ваш комментарий" })
      .fill("Новый комментарий после первой страницы");
    await page.getByRole("button", { name: "Отправить комментарий" }).click();
    await page
      .getByText("Новый комментарий после первой страницы", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Ещё комментарии" }).click();
    await page.waitForFunction(
      () => document.querySelectorAll(".comment").length === 53,
    );
    await page
      .getByText("Комментарий для пагинации 51", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Назад", exact: true }).click();
    await page.waitForFunction(
      () => !new URLSearchParams(location.search).has("post"),
    );
  }
  // Read another author and make sure the following feed shows their posts.
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "Лента", exact: true })
    .click();
  const followedName = await page
    .locator(".post-card")
    .nth(1)
    .locator(".profile-link strong")
    .textContent();
  await page.locator(".post-card").nth(1).locator(".profile-link").click();
  await page.getByRole("button", { name: "Читать", exact: true }).click();
  await page.getByRole("button", { name: "Вы читаете", exact: true }).waitFor();
  await page.getByRole("button", { name: "В ленту" }).click();
  await page
    .locator(".feed-tabs")
    .getByRole("button", { name: "Вы читаете", exact: true })
    .click();
  await page.waitForFunction((name) => {
    const cards = [...document.querySelectorAll(".post-card")];
    return (
      cards.length > 0 &&
      cards.every(
        (c) => c.querySelector(".profile-link strong")?.textContent === name,
      )
    );
  }, followedName);
  // Search and keyboard escape on dialogs.
  await page.locator(".search-box input").fill(title);
  await page.locator(".search-box input").press("Enter");
  await page.locator(".post-card").first().waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll(".post-card").length === 1,
  );
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "Мой профиль", exact: true })
    .click();
  await page.getByRole("heading", { name: "Читатель Тестов" }).waitFor();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.getByRole("button", { name: "Войти" }).click();
  await page.getByLabel("Gmail", { exact: true }).fill(username + "@gmail.com");
  await page.locator("input[name=password]").fill("Mood-test-password-123");
  await page.getByRole("button", { name: "Войти", exact: true }).last().click();
  await page.locator(".account").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Создать пост" })
    .click();
  await page.getByRole("heading", { name: "Новый пост" }).waitFor();
  await page
    .locator('[role="dialog"]')
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await page.screenshot({
    path: artifacts + "composer-mobile.png",
  });
  await page.keyboard.press("Escape");
  await page
    .getByRole("heading", { name: "Новый пост" })
    .waitFor({ state: "hidden" });
  await page
    .locator(".topbar")
    .getByRole("button", { name: "Поиск", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Поисковый запрос" }).fill(title);
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await page
    .getByText("Это моё отдельное мнение, а не часть цитаты.", { exact: true })
    .waitFor();
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      result: "PASS",
      username,
      title,
      checks:
        "Guest gates, avatar signup, session persistence, PDF upload, duplicate detection, book thanks, quote/opinion separation, post, likes, comments, bookmark, follow feed, search, profile, logout/login, mobile modal, no JS errors",
    }),
  );
} catch (e) {
  await page.screenshot({ path: artifacts + "failure.png" });
  console.error(
    "Form error:",
    await page.locator(".form-error").allTextContents(),
  );
  throw e;
} finally {
  await browser.close();
  if (process.env.MOOD_TEST_CLEANUP === "1") cleanup(username);
}
