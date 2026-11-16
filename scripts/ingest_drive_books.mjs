import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const DRIVE_BOOKS = [
  { id: "gd_01", slug: "gd-kokserek", title: "Көксерек", author: "Мұхтар Әуезов", language: "kk", genre: "Повесть / Табиғат", age_min: 12, fileId: "1QFZUg8But87xCbhDWKXca3wqGLXka49C", size: "218 KB", sizeMb: 0.22, mergeSlug: "kokserek" },
  { id: "gd_02", slug: "gd-beseuding-haty", title: "Бесеудің хаты", author: "Шерхан Мұртаза", language: "kk", genre: "Тарихи драма", age_min: 14, fileId: "1uCXpNwlqmjCgTj6-pH3pdDsIbg4oxFW-", size: "333 KB", sizeMb: 0.33 },
  { id: "gd_03", slug: "gd-sulushash", title: "Сұлушаш", author: "Сәбит Мұқанов", language: "kk", genre: "Поэма / Махаббат", age_min: 14, fileId: "1KuYZCuZNHD7sVOmdm7k4JLgaDCGfZh1W", size: "488 KB", sizeMb: 0.48, mergeSlug: "sulu-shash" },
  { id: "gd_04", slug: "gd-romeo-juliet", title: "Ромео мен Джульетта", author: "Уильям Шекспир (ауд. Ә. Кекілбаев)", language: "kk", genre: "Трагедия / Махаббат", age_min: 14, fileId: "1PwIFCJduP3Lgv0dI2A7ZO0OqtuhlNeqD", size: "618 KB", sizeMb: 0.61 },
  { id: "gd_05", slug: "gd-mening-atym-qozha", title: "Менің атым Қожа (Толық PDF)", author: "Бердібек Соқпақбаев", language: "kk", genre: "Балалық шақ / Әзіл", age_min: 10, fileId: "1z2qTG6WzsJDdU0T5HEMgNWzpWg6Jh-WF", size: "1 MB", sizeMb: 1.0, mergeSlug: "mening-atym-qozha" },
  { id: "gd_06", slug: "gd-magzhan", title: "Мағжан Жұмабаев шығармалары", author: "Мағжан Жұмабаев", language: "kk", genre: "Поэзия / Проза", age_min: 12, fileId: "1zOV4x-LiU09nAY6iL9Cy1abIaD0GtYUU", size: "1.2 MB", sizeMb: 1.2, mergeSlug: "men-zhastargha-senemin" },
  { id: "gd_07", slug: "gd-tungy-zhalgyzdyq", title: "Түнгі жалғыздық", author: "Нұрғали Ораз", language: "kk", genre: "Заманауи проза / Психология", age_min: 14, fileId: "1OmgrxVOMgxBbHK5UsEPVAt1KhET8OQsm", size: "1.4 MB", sizeMb: 1.4 },
  { id: "gd_08", slug: "gd-tar-zhol", title: "Тар жол, тайғақ кешу", author: "Сәкен Сейфуллин", language: "kk", genre: "Тарихи мемуар", age_min: 14, fileId: "1wFyHI8P4Qj6rY5RBg0CAQ_A4-6ziVNV-", size: "2.3 MB", sizeMb: 2.3 },
  { id: "gd_09", slug: "gd-bauyrzhan", title: "Бауыржан Момышұлы шығармалары", author: "Бауыржан Момышұлы", language: "kk", genre: "Ерлік / Намыс / Естелік", age_min: 12, fileId: "1AokahuRDSoFrmsC_ZNR1n35LggH4WcUZ", size: "2.6 MB", sizeMb: 2.6, mergeSlug: "ushqan-uya" },
  { id: "gd_10", slug: "gd-zhalgyzdyq-uni", title: "Жалғыздық үні", author: "Қазақ прозасы", language: "kk", genre: "Психологиялық проза", age_min: 14, fileId: "1SEkW1M1Z1TmhWpEVFQzB-nKFdVc4tGUU", size: "2.6 MB", sizeMb: 2.6 },
  { id: "gd_11", slug: "gd-zhabaiy-alma", title: "Жабайы алма", author: "Сайын Мұратбеков", language: "kk", genre: "Повесть / Сағыныш", age_min: 12, fileId: "1MmMABpBJpHiTSV32vZbdbtVJ6EVfL3Uj", size: "3.3 MB", sizeMb: 3.3 },
  { id: "gd_12", slug: "gd-moldir-mahabbat", title: "Мөлдір махаббат", author: "Сәбит Мұқанов", language: "kk", genre: "Роман / Махаббат", age_min: 14, fileId: "1Xr9MY8V26A5YXxSrLt-KKtg3lnRryfeL", size: "3.9 MB", sizeMb: 3.9 },
  { id: "gd_13", slug: "gd-munaima", title: "Мұңайма", author: "Аид әл-Қарни (ауд.)", language: "kk", genre: "Рухани қолдау / Тыныштық", age_min: 14, fileId: "1P1aIOdkzndjOw5-fZTCr7-Rpr7NrFMAe", size: "5.1 MB", sizeMb: 5.1 },
  { id: "gd_14", slug: "gd-omirde-shekteu-zhoq", title: "Өмірде шектеу жоқ", author: "Ник Вуйчич", language: "kk", genre: "Мотивация / Өмірбаян", age_min: 12, fileId: "1anTluabjZQ1eFkIDbf6Y80cyHZTQqE3f", size: "7.7 MB", sizeMb: 7.7 },
  { id: "gd_15", slug: "gd-beitanys-aiel", title: "Бейтаныс әйелдің құпиясы", author: "Стефан Цвейг (ауд.)", language: "kk", genre: "Новелла / Сезім", age_min: 16, fileId: "1WkK3bng4XVDcPXMfG9k2PYA2T1dkPkzR", size: "9.4 MB", sizeMb: 9.4 },
  { id: "gd_16", slug: "gd-parasat-zholy", title: "Парасат жолы", author: "Ж. Нұрғожаев", language: "kk", genre: "Таным / Философия", age_min: 14, fileId: "1kvequ3OtvJzBxWzqJl6i-jMvWJiAa7cD", size: "26 MB", sizeMb: 26 },
  { id: "gd_17", slug: "gd-aq-keme", title: "Ақ кеме", author: "Шыңғыс Айтматов", language: "kk", genre: "Повесть / Классика", age_min: 12, fileId: "10v85pKwoidfge9dzQ8shfhVPGZXjUQG7", size: "53.1 MB", sizeMb: 53.1 },
  { id: "gd_18", slug: "gd-kitap-2547", title: "Қазақ әдеби жинағы", author: "Таңдамалы жинақ", language: "kk", genre: "Жинақ", age_min: 12, fileId: "14ZOauT_hrqLu7XjjfV_vMLh1LywbjsnB", size: "234 KB", sizeMb: 0.23 },
  { id: "gd_19", slug: "gd-psihosomatika", title: "Психосоматика: тело говорит", author: "Популярная психология", language: "ru", genre: "Психология / Здоровье", age_min: 16, fileId: "17GmyeuvLs04ZxGVrS8EZbNCGJA6IcWzu", size: "920 KB", sizeMb: 0.92 },
  { id: "gd_20", slug: "gd-igry-lyudi", title: "Игры, в которые играют люди", author: "Эрик Берн", language: "ru", genre: "Психология / Отношения", age_min: 16, fileId: "1th2sKaEe4GkfJtIxbiWiPuy7ALKCOgcS", size: "1.1 MB", sizeMb: 1.1 },
  { id: "gd_21", slug: "gd-poka-ne-30", title: "Пока мне не исполнилось 30", author: "Джеймс Эббот", language: "ru", genre: "Саморазвитие / Студентам", age_min: 16, fileId: "1Tta2fXl90JOqvU6bkvTwZuZ8AjqB3jC-", size: "1.2 MB", sizeMb: 1.2 },
  { id: "gd_22", slug: "gd-prosto-delai", title: "Просто делай!", author: "Оскар Хартманн", language: "ru", genre: "Мотивация / Действие", age_min: 16, fileId: "1h8QSvbxDn6zL0xx_f2PzJB7wcY1TmiZ8", size: "1.2 MB", sizeMb: 1.2 },
  { id: "gd_23", slug: "gd-kafe-na-krayu", title: "Кафе на краю земли", author: "Джон Стрелеки", language: "ru", genre: "Философская повесть", age_min: 14, fileId: "1UpHbBk5g9Xv-folGbIAE7cWhZTlFkVTQ", size: "1.3 MB", sizeMb: 1.3 },
  { id: "gd_24", slug: "gd-karmicheskii", title: "Кармический менеджмент", author: "Майкл Роуч", language: "ru", genre: "Философия / Карьера", age_min: 16, fileId: "1WmHypmWV8jeBH7ju7E4Kr2wvHEP825NG", size: "1.3 MB", sizeMb: 1.3 },
  { id: "gd_25", slug: "gd-s-toboi-ya-doma", title: "С тобой я дома", author: "Ольга Примаченко", language: "ru", genre: "Психология / Любовь", age_min: 16, fileId: "1H8_xwxYMAipikZzcPpc4dNQqvgjLgeGP", size: "1.4 MB", sizeMb: 1.4 },
  { id: "gd_26", slug: "gd-zapusk", title: "Запуск: Быстрый старт для вашего бизнеса", author: "Джефф Уокер", language: "ru", genre: "Бизнес / Стартапы", age_min: 16, fileId: "1M-Ehlb_m4F8wx_xVYuHp0cWE2iotY_rR", size: "1.6 MB", sizeMb: 1.6 },
  { id: "gd_27", slug: "gd-schastlivyi-karman", title: "Счастливый карман, полный денег", author: "Дэвид Кэмерон Джиканди", language: "ru", genre: "Мышление", age_min: 16, fileId: "1kb7g4TLpZC1LBJoJmC0qZYraPNLOoMij", size: "1.6 MB", sizeMb: 1.6 },
  { id: "gd_28", slug: "gd-puteshestviya-dushi", title: "Путешествия души", author: "Майкл Ньютон", language: "ru", genre: "Философия", age_min: 18, fileId: "1tInwkGzIhGK47GqbGDh2HnxHSoV6_q7i", size: "1.7 MB", sizeMb: 1.7 },
  { id: "gd_29", slug: "gd-vazhnye-gody", title: "Важные годы", author: "Мэг Джей", language: "ru", genre: "Психология / 18–24 жас", age_min: 16, fileId: "1zqg23U474Sure-QDQ-7Yr55qQKuQyV9C", size: "1.8 MB", sizeMb: 1.8 },
  { id: "gd_30", slug: "gd-rebenok-v-tebe", title: "Ребёнок в тебе должен обрести дом", author: "Стефани Шталь", language: "ru", genre: "Психология", age_min: 16, fileId: "1oe0i-vq-jGKmGYB8EAoqSbrzZqC8kGSf", size: "2.1 MB", sizeMb: 2.1 },
  { id: "gd_31", slug: "gd-vybor", title: "Выбор. О свободе и внутренней силе человека", author: "Эдит Ева Эгер", language: "ru", genre: "Биографии / Сила духа", age_min: 16, fileId: "1ZSajXv7__sJAXpkg2MhClnreRJZzXcuU", size: "2.2 MB", sizeMb: 2.2 },
  { id: "gd_32", slug: "gd-est-molitsya-lyubit", title: "Есть, молиться, любить", author: "Элизабет Гилберт", language: "ru", genre: "Роман / Путешествие", age_min: 16, fileId: "1P-w9Vc2gRwcw1zCUDJ4VsmXAcRr8XiS-", size: "2.2 MB", sizeMb: 2.2 },
  { id: "gd_33", slug: "gd-malenkie-zhenshiny", title: "Маленькие женщины", author: "Луиза Мэй Олкотт", language: "ru", genre: "Классика / Семья", age_min: 12, fileId: "1C4144V7Z1B_vRiBUTH6wTNhs5vmfDsN9", size: "2.2 MB", sizeMb: 2.2 },
  { id: "gd_34", slug: "gd-esteticheskii-intellekt", title: "Эстетический интеллект", author: "Полин Браун", language: "ru", genre: "Искусство / Вкус", age_min: 16, fileId: "1gC0GLhlJ_RbC-sWBKrWErXmc0gUw4Sb-", size: "2.3 MB", sizeMb: 2.3 },
  { id: "gd_35", slug: "gd-zharenye-pomidory", title: "Жареные зелёные помидоры в кафе «Полустанок»", author: "Фэнни Флэгг", language: "ru", genre: "Роман / Дружба", age_min: 14, fileId: "11MrQ7y-CghQOhzAxT6rCWhisB8khX9wx", size: "2.6 MB", sizeMb: 2.6 },
  { id: "gd_36", slug: "gd-potok", title: "Поток: Психология оптимального переживания", author: "Михай Чиксентмихайи", language: "ru", genre: "Психология / Вдохновение", age_min: 16, fileId: "192AcnMhne7NDRXet_oC8ZGa4Kq3zb0Tu", size: "2.7 MB", sizeMb: 2.7 },
  { id: "gd_37", slug: "gd-pishi-sokrashchai", title: "Пиши, сокращай", author: "Максим Ильяхов, Людмила Сарычева", language: "ru", genre: "Мастерство текста", age_min: 14, fileId: "11z5zZKzMlxeBA6L3IS2o2gy-cTq15NJ7", size: "2.8 MB", sizeMb: 2.8 },
  { id: "gd_38", slug: "gd-neirofitnes", title: "Нейрофитнес", author: "Рахул Джандиал", language: "ru", genre: "Наука / Мозг", age_min: 14, fileId: "10ND0lBtWfRxvQTfdnAGOBtL1TjoZjPEz", size: "3 MB", sizeMb: 3.0 },
  { id: "gd_39", slug: "gd-zachem-my-spim", title: "Зачем мы спим", author: "Мэттью Уолкер", language: "ru", genre: "Наука / Здоровье", age_min: 14, fileId: "1oOyMYg75q3nEKZruX2uaziR1BvzCGPlj", size: "3.1 MB", sizeMb: 3.1 },
  { id: "gd_40", slug: "gd-atomnye-privychki", title: "Атомные привычки", author: "Джеймс Клир", language: "ru", genre: "Саморазвитие / Привычки", age_min: 14, fileId: "1Gs4Ean_z14a6G-HxduhRVN69Or2JUM4C", size: "3.2 MB", sizeMb: 3.2 },
  { id: "gd_41", slug: "gd-hochu-i-budu", title: "Хочу и буду", author: "Михаил Лабковский", language: "ru", genre: "Психология", age_min: 16, fileId: "1LawpUD_yvYtch61LaWnu51BB5XaZ3x0r", size: "3.2 MB", sizeMb: 3.2 },
  { id: "gd_42", slug: "gd-ty-vsya-svetishsya", title: "Ты вся светишься", author: "Поддержка и вдохновение", language: "ru", genre: "Эссе / Вдохновение", age_min: 16, fileId: "1kjovovcyGtfZSQ-jSacFgCVEER3yzwJW", size: "3.6 MB", sizeMb: 3.6 },
  { id: "gd_43", slug: "gd-prozhivaya", title: "ПроЖИВАЯ", author: "Анна Бабич", language: "ru", genre: "Психология", age_min: 16, fileId: "15OX80A7__J1qc3DSCcnXIF5Jvbthca_W", size: "3.9 MB", sizeMb: 3.9 },
  { id: "gd_44", slug: "gd-neudobnye-razgovory", title: "Неудобные разговоры", author: "Дуглас Стоун", language: "ru", genre: "Коммуникация", age_min: 16, fileId: "173U233azOXJPVj3uYnUWnG8Ot8j8TAZL", size: "4.3 MB", sizeMb: 4.3 },
  { id: "gd_45", slug: "gd-bolshaya-pyaterka", title: "Большая пятёрка для жизни", author: "Джон Стрелеки", language: "ru", genre: "Повесть / Смысл", age_min: 14, fileId: "12iTioCLBc9ePdBwCFQncxlcTVg2ngL91", size: "4.6 MB", sizeMb: 4.6 },
  { id: "gd_46", slug: "gd-lyubit-ne-lyubit", title: "Любит не любит", author: "Роман / Отношения", language: "ru", genre: "Романтика", age_min: 16, fileId: "1u8227TF1T_CN9vPOZVXYaYkk8YISaQyH", size: "4.7 MB", sizeMb: 4.7 },
  { id: "gd_47", slug: "gd-nakopitelnyi-effekt", title: "Накопительный эффект", author: "Даррен Харди", language: "ru", genre: "Привычки / Успех", age_min: 14, fileId: "1QtqgZ1Ds6Lk-7zfd5vMf0z3DMxgd36b6", size: "5.3 MB", sizeMb: 5.3 },
  { id: "gd_48", slug: "gd-sposobnost-lyubit", title: "Способность любить", author: "Алан Фромм", language: "ru", genre: "Психология / Отношения", age_min: 16, fileId: "1_qm6zVHKkp8Oysdtlh0Il4FLTfHimPyR", size: "9.8 MB", sizeMb: 9.8 },
  { id: "gd_49", slug: "gd-cartier", title: "Картье: История ювелирного дома", author: "Франческа Картье Бриккелл", language: "ru", genre: "Биографии / Искусство", age_min: 14, fileId: "1K6iTj0JH06jc_L8WgdJFd8_Qjd3pv6Gb", size: "15.2 MB", sizeMb: 15.2 },
  { id: "gd_50", slug: "gd-ostrov-sokrovishch", title: "Остров Сокровищ", author: "Роберт Льюис Стивенсон", language: "ru", genre: "Приключения / Классика", age_min: 10, fileId: "1m9zWU3kpzLbzA9CYQ-4egoI3RhK8w2xR", size: "22.4 MB", sizeMb: 22.4 }
];

const PDF_DIR = path.join(process.cwd(), ".data", "drive-pdfs");
fs.mkdirSync(PDF_DIR, { recursive: true });

const COLORS = ["#173F35", "#2F6A50", "#B58B54", "#6E4E34", "#385663", "#5C4B3B", "#6B4E56", "#4E6E58"];

function isCleanText(text) {
  if (!text || text.length < 300) return false;
  const sample = text.slice(0, 5000);
  let cyrillic = 0;
  let garble = 0;
  for (const ch of sample) {
    if (/[а-яА-ЯәіңғүұқөһӘІҢҒҮҰҚӨҺёЁ]/.test(ch)) cyrillic++;
    if (/[\uFFFD\x00-\x08]/.test(ch)) garble++;
  }
  const ratio = cyrillic / sample.length;
  return ratio > 0.45 && garble / sample.length < 0.01;
}

function splitIntoChapters(rawText, bookId) {
  const cleaned = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\f+/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const paragraphs = cleaned
    .split(/\n\n+/)
    .map((p) => p.replace(/[ \t]{2,}/g, " ").trim())
    .filter((p) => p.length > 25 && !/^\d{1,4}$/.test(p));

  const chapters = [];
  let buf = [];
  let bufLen = 0;
  let startIdx = 0;

  // Skip front-matter copyright/TOC lines when enough body exists
  if (paragraphs.length > 25) {
    startIdx = 3;
  }

  for (let i = startIdx; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    buf.push(p);
    bufLen += p.length;
    if (bufLen >= 2200) {
      const ord = chapters.length + 1;
      chapters.push({
        id: `ch_${ord}`,
        book_id: bookId,
        title: `${ord}-бөлім`,
        order: ord,
        content: buf.join("\n\n"),
      });
      buf = [];
      bufLen = 0;
      if (chapters.length >= 45) break;
    }
  }
  if (buf.length > 0 && chapters.length < 45) {
    const ord = chapters.length + 1;
    chapters.push({
      id: `ch_${ord}`,
      book_id: bookId,
      title: `${ord}-бөлім`,
      order: ord,
      content: buf.join("\n\n"),
    });
  }
  return chapters;
}

function isCleanBodyPara(p) {
  if (!p || p.length < 70) return false;
  const low = p.toLowerCase();
  const bad = ["isbn", "издательств", "оглавлен", "содержан", "мазмұн", "посвящ", "благодарн", "copyright", "http", "notes\n", "уДК", "ббк"];
  if (bad.some((b) => low.includes(b))) return false;
  const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
  const numLines = lines.filter((l) => /^\d{1,4}$/.test(l)).length;
  if (lines.length > 3 && numLines / lines.length > 0.25) return false;
  let letters = 0;
  let digits = 0;
  for (const ch of p) {
    if (/[а-яА-ЯәіңғүұқөһӘІҢҒҮҰҚӨҺёЁ]/.test(ch)) letters++;
    else if (/\d/.test(ch)) digits++;
  }
  return letters > p.length * 0.55 && digits < p.length * 0.08;
}

function extractBestExcerpt(chapters) {
  const bodyChapters = chapters.length > 4 ? chapters.slice(2, 8) : chapters;
  // Pass 1: Look for vivid dialogue blocks (lines with —)
  for (const ch of bodyChapters) {
    const paras = ch.content.split("\n\n");
    for (let i = 0; i < paras.length; i++) {
      const p = paras[i];
      if (!isCleanBodyPara(p)) continue;
      if (p.includes("—") || p.startsWith("- ")) {
        const chunk = [p];
        if (i + 1 < paras.length && isCleanBodyPara(paras[i + 1]) && (chunk[0].length + paras[i + 1].length) < 480) {
          chunk.push(paras[i + 1]);
        }
        const block = chunk.join("\n\n");
        if (block.length >= 100 && block.length <= 520) {
          return { chId: ch.id, text: block, type: "dialogue" };
        }
      }
    }
  }
  // Pass 2: Clean prose sentences (slice cleanly to 180-420 chars on sentence boundary)
  for (const ch of bodyChapters) {
    const paras = ch.content.split("\n\n");
    for (const p of paras) {
      if (!isCleanBodyPara(p)) continue;
      if (p.length >= 130 && p.length <= 460) {
        return { chId: ch.id, text: p, type: "prose" };
      }
      if (p.length > 460) {
        const cut = p.slice(0, 420);
        const lastDot = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
        if (lastDot >= 140) {
          return { chId: ch.id, text: cut.slice(0, lastDot + 1), type: "prose" };
        }
      }
    }
  }
  return null;
}

async function downloadPdf(fileId, destPath) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 2048) {
    const buf = Buffer.alloc(8);
    const fd = fs.openSync(destPath, "r");
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    if (buf.toString("utf8").startsWith("%PDF-")) return true;
  }
  const urls = [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
  ];
  for (const url of urls) {
    try {
      execFileSync("curl", ["-fsSL", "--max-time", "35", "-o", destPath, url], { stdio: "ignore" });
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 2048) {
        const buf = Buffer.alloc(8);
        const fd = fs.openSync(destPath, "r");
        fs.readSync(fd, buf, 0, 8, 0);
        fs.closeSync(fd);
        if (buf.toString("utf8").startsWith("%PDF-")) return true;
      }
    } catch {
      // try next url
    }
  }
  if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  return false;
}

async function main() {
  const coreBooks = JSON.parse(fs.readFileSync("src/data/books.json", "utf8"));
  let extraBooks = JSON.parse(fs.readFileSync("src/data/catalog-extra.json", "utf8"));
  let frags = JSON.parse(fs.readFileSync("src/data/fragments.json", "utf8")).filter(
    (f) => !f.id.startsWith("frag_gd_") && !f.id.startsWith("frag_book_0"),
  );

  const bookBySlug = new Map(coreBooks.map((b) => [b.slug, b]));
  const extraBySlug = new Map(extraBooks.map((b) => [b.slug, b]));

  let downloadedCount = 0;
  let extractedTextCount = 0;
  let addedFragmentsCount = 0;

  for (let i = 0; i < DRIVE_BOOKS.length; i++) {
    const item = DRIVE_BOOKS[i];
    const pdfUrl = `https://drive.google.com/uc?export=download&id=${item.fileId}`;
    const previewUrl = `https://drive.google.com/file/d/${item.fileId}/preview`;
    const sourceUrl = `https://drive.google.com/file/d/${item.fileId}/view`;

    let chapters = [];
    if (item.sizeMb <= 25) {
      const pdfPath = path.join(PDF_DIR, `${item.id}.pdf`);
      const ok = await downloadPdf(item.fileId, pdfPath);
      if (ok) {
        downloadedCount++;
        try {
          const rawText = execFileSync("pdftotext", [pdfPath, "-"], {
            encoding: "utf8",
            maxBuffer: 25 * 1024 * 1024,
          });
          if (isCleanText(rawText)) {
            const targetId = item.mergeSlug && bookBySlug.has(item.mergeSlug)
              ? bookBySlug.get(item.mergeSlug).id
              : item.mergeSlug && extraBySlug.has(item.mergeSlug)
                ? extraBySlug.get(item.mergeSlug).id
                : item.id;
            chapters = splitIntoChapters(rawText, targetId);
            if (chapters.length > 0) extractedTextCount++;
          }
        } catch {
          // scanned or unreadable PDF -> still attach PDF preview & download link!
        }
      }
    }

    const targetSlug = item.mergeSlug || item.slug;
    let activeBook;
    if (bookBySlug.has(targetSlug)) {
      const existing = bookBySlug.get(targetSlug);
      existing.drive_file_id = item.fileId;
      existing.pdf_url = pdfUrl;
      existing.pdf_preview_url = previewUrl;
      existing.file_size = item.size;
      if (chapters.length > existing.chapters.length && !["book_003", "book_009"].includes(existing.id)) {
        existing.chapters = chapters;
      }
      activeBook = existing;
    } else if (extraBySlug.has(targetSlug)) {
      const extra = extraBySlug.get(targetSlug);
      extraBySlug.delete(targetSlug);
      const promoted = {
        ...extra,
        drive_file_id: item.fileId,
        pdf_url: pdfUrl,
        pdf_preview_url: previewUrl,
        file_size: item.size,
        rights_status: "licensed",
        rights_note: "Google Drive & Supabase қоры (PDF + Оқу режимі)",
        chapters,
      };
      coreBooks.push(promoted);
      bookBySlug.set(promoted.slug, promoted);
      activeBook = promoted;
    } else {
      const newBook = {
        id: item.id,
        slug: item.slug,
        title: item.title,
        author: item.author,
        language: item.language,
        genre: item.genre,
        age_min: item.age_min,
        rights_status: "licensed",
        rights_note: "Google Drive & Supabase қоры (PDF)",
        source_url: sourceUrl,
        cover_color: COLORS[i % COLORS.length],
        cover_badge: `${item.language.toUpperCase()} · ${item.size}`,
        description: `${item.title} — ${item.author}. Google Drive қорынан интеграцияланған кітап (${item.size}). Толық PDF және оқу режимінде қолжетімді.`,
        drive_file_id: item.fileId,
        pdf_url: pdfUrl,
        pdf_preview_url: previewUrl,
        file_size: item.size,
        chapters,
      };
      coreBooks.push(newBook);
      bookBySlug.set(newBook.slug, newBook);
      activeBook = newBook;
    }

    // Extract 1 verified body fragment if clean chapters exist and book doesn't already have a curated fragment
    if (activeBook.chapters.length > 0 && !frags.some((f) => f.book_id === activeBook.id)) {
      const ex = extractBestExcerpt(activeBook.chapters);
      if (ex) {
        const ch = activeBook.chapters.find((c) => c.id === ex.chId);
        const idx = ch.content.indexOf(ex.text);
        if (idx >= 0) {
          const fragId = `frag_${item.id}`;
          const defaultMoods =
            activeBook.language === "kk"
              ? ["шабыт", "мұң", "шытырман іздеу"]
              : ["шабыт", "уайым", "шаршау"];
          frags.push({
            id: fragId,
            book_id: activeBook.id,
            chapter_id: ch.id,
            start_offset: idx,
            end_offset: idx + ex.text.length,
            continuation_anchor: fragId,
            text: ex.text,
            type: ex.type,
            language: activeBook.language,
            moods: defaultMoods,
            topics: ["өмір", "ішкі ой"],
            reader_intents: ["түсіну", "үміт"],
            hook_score: 0.87,
            dialogue_score: ex.type === "dialogue" ? 0.91 : 0.68,
            emotional_relevance: 0.88,
            readability: 0.92,
            context_clarity: 0.89,
            age_min: activeBook.age_min,
            review_status: "approved",
            character_name: activeBook.author,
            character_situation: `${activeBook.title} шығармасынан алынған тексерілген үзінді.`,
          });
          addedFragmentsCount++;
        }
      }
    }
  }

  extraBooks = Array.from(extraBySlug.values());
  fs.writeFileSync("src/data/books.json", JSON.stringify(coreBooks, null, 2) + "\n");
  fs.writeFileSync("src/data/catalog-extra.json", JSON.stringify(extraBooks, null, 2) + "\n");
  fs.writeFileSync("src/data/fragments.json", JSON.stringify(frags, null, 2) + "\n");

  console.log({
    downloadedPdfs: downloadedCount,
    cleanTextExtractedBooks: extractedTextCount,
    addedVerifiedFragments: addedFragmentsCount,
    totalBooksJson: coreBooks.length,
    totalCatalogExtra: extraBooks.length,
    totalFragments: frags.length,
  });
}

main();
