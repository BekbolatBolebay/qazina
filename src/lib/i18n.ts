import type { LanguageCode } from "@/types/book";

export const UI_COPY: Record<
  LanguageCode,
  {
    brand: string;
    slogan: string;
    nav: {
      home: string;
      discover: string;
      quest: string;
      books: string;
      moments: string;
      saved: string;
      profile: string;
      admin: string;
    };
    mood: {
      question: string;
      subtitle: string;
      placeholder: string;
      intentLabel: string;
      ageLabel: string;
      submit: string;
      searching: string;
      emptyError: string;
      dialogueFirst: string;
    };
    fragment: {
      hiddenBadge: string;
      revealBtn: string;
      skipBtn: string;
      saveBtn: string;
      shareBtn: string;
      continueReading: string;
      dilemmaTitle: string;
      characterMatch: string;
    };
  }
> = {
  kk: {
    brand: "QAZINA",
    slogan: "Кітапты іздеме. Оқиға сені тапсын.",
    nav: {
      home: "Басты бет",
      discover: "Үзінді",
      quest: "Квест",
      books: "Кітаптар",
      moments: "Сәттер",
      saved: "Сақталған",
      profile: "Профиль",
      admin: "Басқару",
    },
    mood: {
      question: "Бүгін өзіңді қалай сезініп тұрсың?",
      subtitle: "Ойыңды жаз. Біз саған сәйкес келетін бір оқиғаны табуға тырысамыз.",
      placeholder: "Мысалы: «Оқу мен өмірден сәл шаршадым, бірақ жаңа үміт пен тыныштық іздеп жүрмін...»",
      intentLabel: "Қазір қандай оқиға оқығың келеді?",
      ageLabel: "Жас санаты:",
      submit: "Үзінді табу",
      searching: "Мәтін қорынан үндес үзінді іздеп жатырмыз...",
      emptyError: "Ойыңды жаз немесе төменнен дайын көңіл күйді таңда.",
      dialogueFirst: "Dialogue First · Жанды диалогқа басымдық",
    },
    fragment: {
      hiddenBadge: "Кітап атауы мен авторы уақытша жасырын",
      revealBtn: "Ары қарай не болды?",
      skipBtn: "Басқа үзінді",
      saveBtn: "Ой сақтау",
      shareBtn: "Бөлісу",
      continueReading: "Кітапты дәл осы жерден жалғастыру →",
      dilemmaTitle: "Сен оның орнында болсаң?",
      characterMatch: "Кейіпкермен сәйкестік",
    },
  },
  ru: {
    brand: "QAZINA",
    slogan: "Не ищи книгу. Пусть история найдёт тебя.",
    nav: {
      home: "Главная",
      discover: "Фрагмент",
      quest: "Квест",
      books: "Книги",
      moments: "Моменты",
      saved: "Сохранённое",
      profile: "Профиль",
      admin: "Админ",
    },
    mood: {
      question: "Как ты себя чувствуешь сегодня?",
      subtitle: "Напиши мысль или выбери настроение — мы найдём отрывок, который отзовётся.",
      placeholder: "Например: «Устал после долгой недели, хочется тишины и понимания...»",
      intentLabel: "Какую историю хочется прочитать сейчас?",
      ageLabel: "Возраст:",
      submit: "Найти отрывок",
      searching: "Подбираем проверенный отрывок под ваше состояние...",
      emptyError: "Напишите текст или выберите готовое настроение.",
      dialogueFirst: "Dialogue First · Приоритет живым диалогам",
    },
    fragment: {
      hiddenBadge: "Название книги и автор скрыты до открытия",
      revealBtn: "Что было дальше?",
      skipBtn: "Другой отрывок",
      saveBtn: "Сохранить мысль",
      shareBtn: "Поделиться",
      continueReading: "Продолжить читать книгу с этого места →",
      dilemmaTitle: "А как поступил бы ты на его месте?",
      characterMatch: "Совпадение с героем",
    },
  },
  en: {
    brand: "QAZINA",
    slogan: "Don't search for a book. Let the story find you.",
    nav: {
      home: "Home",
      discover: "Discover",
      quest: "Quest",
      books: "Library",
      moments: "Moments",
      saved: "Saved",
      profile: "Profile",
      admin: "Admin",
    },
    mood: {
      question: "How are you feeling today?",
      subtitle: "Write your thought or pick a mood. We will find one genuine literary fragment for you.",
      placeholder: "Example: \"Tired after exams, looking for quiet clarity and hope...\"",
      intentLabel: "What kind of story do you feel like reading?",
      ageLabel: "Age group:",
      submit: "Find a fragment",
      searching: "Finding a verified literary fragment for your state...",
      emptyError: "Write a short thought or pick a mood chip below.",
      dialogueFirst: "Dialogue First · Prioritizing vivid dialogues",
    },
    fragment: {
      hiddenBadge: "Title and author remain hidden until reveal",
      revealBtn: "What happened next?",
      skipBtn: "Another fragment",
      saveBtn: "Save thought",
      shareBtn: "Share",
      continueReading: "Continue reading from this exact spot →",
      dilemmaTitle: "If you were in their shoes...",
      characterMatch: "Character Match",
    },
  },
};
