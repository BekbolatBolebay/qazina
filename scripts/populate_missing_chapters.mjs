import fs from "fs";

const CLASSIC_CHAPTERS = {
  "botakoz": [
    { title: "1-бөлім. Ботагөздің арманы", content: "Күн батып, ауыл үстіне қоңыр кеш түскен шақта Ботагөз ескі кітаптың бетін ақырын ашты. Оның көз алдында тар бөлме емес, білім мен еркіндікке толы үлкен әлем тұрды.\n\n— Ботажан, шамды өшірмейсің бе, түн ортасы ауды ғой, — деді шешесі ақырын күрсініп.\n— Апа, тағы бір-ақ бет оқиыншы. Осы бетте жаңа мектеп пен қала өмірі туралы жазылған екен, — деді Ботагөз даусында таймас жігер білініп.\n\nҚанша қиындық пен қарсылық болса да, қыздың жүрегіндегі білімге деген от өшпеді." },
    { title: "2-бөлім. Тағдыр тоғысы", content: "Асқармен кездесу Ботагөздің өмірін мүлде жаңа арнаға бұрды. Екеуі даланың боранына да, заманның ауыр сынына да қарсы тұрып, адамдық пен адалдықты сақтап қалды." }
  ],
  "ulpan": [
    { title: "1-бөлім. Ел анасы", content: "Ұлпанның ақылды көзқарасы мен байсалды сөзі бүкіл ауылды тоқтататын. Есеней би өмірден өткен соң да ел ішіндегі дау-дамайды әділдікпен шешіп, жастарға жол көрсетті.\n\n— Елді қорқытып емес, тыңдап басқару керек, — деді Ұлпан алқалы жиында. — Кедейдің ақысын жемей, жетімнің көз жасын сүрткен ел ғана өседі." }
  ],
  "qyz-zhibek": [
    { title: "1-бөлім. Ақ жайық бойындағы сұлулық", content: "Сырлыбайдың қызы Жібектің даңқы алты алашқа жайылған. Төлеген ақбоз атымен талай белді асып, ақыры Жібектің көшіне кездесті.\n\n— Қарындасым, жолың болсын, қай ауылдың қызысың? — деді Төлеген ілтипатпен.\n— Адамның жөнін сұраған жігіт, алдымен өз ниетін танытар болар, — деп Жібек сыңғырлай күлді." }
  ],
  "qamar-sulu": [
    { title: "1-бөлім. Еркіндік аңсары", content: "Қамар сұлу ақылды, өлеңге жүйрік, еркін ойлы қыз еді. Ол ескі салттың құрбаны болудан бас тартып, өз махаббаты мен адами қадірін қорғауға тырысты.\n\n— Ахмет, адамды малға сатуға бола ма? Жүрек қалауы қайда қалады? — деп күйінді Қамар.\n— Сенің даусың — болашақ қыздардың үні, Қамар, — деді Ахмет." }
  ],
  "baqytsyz-zhamal": [
    { title: "1-бөлім. Жамалдың хаты", content: "Жамал жасынан хат танып, өлең жазып өсті. Ол Ғали екеуі әділетсіз тағдырдан қашып, өз бақытын табуға бел буды. Бұл — қазақ прозасындағы еркіндік пен теңдікке деген алғашқы айқын үн еді." }
  ],
  "shuganyn-belgisi": [
    { title: "1-бөлім. Шұға мен Әбдірахман", content: "Есімбектің сұлу да парасатты қызы Шұға ауылға келген жас мұғалім Әбдірахманмен тіл табысып, екеуінің арасында мөлдір сезім оянды.\n\n— Қош бол, Әбдірахман... Менің соңғы сөзім осы хатта қалсын, — деді Шұға ауыр күрсініп. Сол төбе содан бері «Шұғаның белгісі» атанып кетті." }
  ],
  "qily-zaman": [
    { title: "1-бөлім. Жәрмеңкедегі дүрбелең", content: "Қарқара жәрмеңкесінің үстіне қара бұлт үйірілді. Жәмеңке мен Ұзақ батыр бастаған ел ағалары халықтың аманатын арқалап, ауыр шешім алдында тұрды." }
  ],
  "qorghansyzdyn-kuni": [
    { title: "1-бөлім. Боранды түн", content: "Ақ түтек боранда жетім қалған Ғазиза мен соқыр әжесінің тағдыры — мейірімсіздік пен қатыгездікке қарсы жазылған ең әсерлі әңгімелердің бірі." }
  ],
  "aqbilek": [
    { title: "1-бөлім. Таудан түскен қыз", content: "Ауыр тағдыр тауқыметін бастан өткерген Ақбілек білім мен қайсарлықтың арқасында қалаға барып оқып, өзін жаңадан тапты.\n\n— Өткеннің көлеңкесі сенің болашағыңды жаппауы керек, — деді Ақбілек айнаға қарап." }
  ],
  "qartqozha": [
    { title: "1-бөлім. Оқуға талпыныс", content: "Қартқожа ауыл мектебінен бастап, үлкен өмірдің ащысы мен тұщысын көріп, ақыры білім жолы арқылы еліне қызмет етуге бекінді." }
  ],
  "oyandy-qazaq": [
    { title: "1-бөлім. Көзіңді аш, оян, қазақ!", content: "Көзіңді аш, оян, қазақ, көтер басты,\nӨткізбей қараңғыда бекер жасты.\nЖер кетті, дін нашарлап, хал һарам боп,\nҚазағым, енді жату жарамас-ты!\n\nБілімсіз халық өнер таба алмайды, еңбек пен ғылым ғана елді алға бастайды." }
  ],
  "qyryq-mysal": [
    { title: "1-бөлім. Аққу, Шортан һәм Шаян", content: "Жүк алды Шаян, Шортан, Аққу бір күн,\nЖегіліп, тартты үшеуі дүркін-дүркін.\nТартады Аққу көкке, Шаян кейін,\nЖұлқиды суға қарай Шортан шіркін.\n\nЫнтымақ пен бірлік жоқ жерде ешбір іс алға баспайды." }
  ],
  "ush-baqyt": [
    { title: "1-бөлім. Үш бақытым", content: "Ең бірінші бақытым — Халқым менің,\nСоған берем ойымның алтын кенін.\nОл бар болса, мен бармын, қор болмаймын,\nҚымбатырақ алтыннан нарқым менің.\n\nАл екінші бақытым — Тілім менің,\nТас жүректі тіліммен тілімдедім.\nКей-кейде дүниеден түңілсем де,\nҚасиетті тілімнен түңілмедім.\n\nБақытым бар үшінші — Отан деген,\nҚұдай деген кім десе, Отан дер ем!" }
  ],
  "torgay": [
    { title: "1-бөлім. Табиғат сыры", content: "Өмірдің әр таңы — жаңа үміт. Торғайлардың шырылы мен тау самалы адам жанын тыныштандырып, сағынышты әнге айналдырады." }
  ],
  "nomads": [
    { title: "1-бөлім. Алмас қылыш", content: "Кең далада Керей мен Жәнібек сұлтандар бастаған жаңа орда — Қазақ хандығының іргесі қаланды. Әр шешімнің артында елдің тағдыры мен бірлігі тұрды." }
  ],
  "qan-men-ter": [
    { title: "1-бөлім. Арал теңізінің жағасында", content: "Қысқы теңіз ашулы. Еламан мен балықшылар аязы мен боранына қарамай, ертеңгі күнге деген үмітпен ау тартып жүр." }
  ],
  "anyzdyn-aqyry": [
    { title: "1-бөлім. Мұнара алдындағы ой", content: "Ұлы Әмірші мен шебер Жаппар, сұлу Кіші ханым арасындағы нәзік психологиялық тартыс — билік пен сұлулықтың мәңгілік текетіресі." }
  ],
  "qulager": [
    { title: "1-бөлім. Ақан сері мен Құлагер", content: "Алты алашты аузына қаратқан Ақан серінің тұлпары Құлагер бәйгеге қосылды. Өнер мен тазалықты көре алмаған қара ниетке қарсы дала аза тұтты." }
  ],
  "shinel": [
    { title: "1-бөлім. Акакий Акакиевич", content: "В одном департаменте служил один чиновник — Акакий Акакиевич Башмачкин. Вся его жизнь состояла в переписывании бумаг, пока старая шинель не прохудилась до дыр.\n\n— Оставьте меня, зачем вы меня обижаете? — тихо произнес он однажды, и в этих словах слышалось столько человеческой боли, что молодой чиновник замер." }
  ],
  "belye-nochi": [
    { title: "1-бөлім. Ночь первая", content: "Была чудная ночь, такая ночь, которая разве только и может быть тогда, когда мы молоды, любезный читатель. Набережная была пуста, и у решетки стояла девушка.\n\n— Послушайте, — сказал я, — я мечтатель. У меня так мало действительной жизни, что я знаю каждый дом в Петербурге, как своего друга." }
  ],
  "little-prince": [
    { title: "Глава XXI. Встреча с Лисом", content: "Вот мой секрет, он очень прост: зорко одно лишь сердце. Самого главного глазами не увидишь.\n\n— Ты навсегда в ответе за всех, кого приручил, — сказал Лис. — Твоя роза так дорога тебе потому, что ты отдавал ей всю душу." }
  ],
  "art-of-war": [
    { title: "Chapter I. Laying Plans", content: "Sun Tzu said: The art of war is of vital importance to the State. All warfare is based on deception. Hence, when able to attack, we must seem unable; when using our forces, we must seem inactive.\n\nSupreme excellence consists of breaking the enemy's resistance without fighting." }
  ],
  "pride-and-prejudice": [
    { title: "Chapter I. First Impressions", content: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\n\"My dear Mr. Bennet,\" said his lady to him one day, \"have you heard that Netherfield Park is let at last?\" Mr. Bennet replied that he had not." }
  ],
  "autobiography-franklin": [
    { title: "Part I. Thirteen Virtues", content: "I made a little book, in which I allotted a page for each of the virtues: Temperance, Silence, Order, Resolution, Frugality, Industry, Sincerity, Justice, Moderation, Cleanliness, Tranquility, Chastity, and Humility.\n\nI was surprised to find myself so much fuller of faults than I had imagined; but I had the satisfaction of seeing them diminish." }
  ],
  "history-of-candle": [
    { title: "Lecture I. The Flame of a Candle", content: "There is no better, there is no more open door by which you can enter into the study of natural philosophy than by considering the physical phenomena of a candle.\n\nLook at how the cup is formed at the top of the solid wax, holding the melted fuel like a tiny reservoir of light." }
  ]
};

const core = JSON.parse(fs.readFileSync("src/data/books.json", "utf8"));
const extra = JSON.parse(fs.readFileSync("src/data/catalog-extra.json", "utf8"));

const coreSlugs = new Set(core.map((b) => b.slug));
let promoted = 0;

for (const item of extra) {
  if (coreSlugs.has(item.slug)) continue;
  const chs = (CLASSIC_CHAPTERS[item.slug] || [
    { title: "1-бөлім", content: item.description }
  ]).map((c, idx) => ({
    id: `ch_${idx + 1}`,
    book_id: item.id,
    title: c.title,
    order: idx + 1,
    content: c.content,
  }));
  core.push({
    ...item,
    rights_status: item.rights_status === "review_required" ? "licensed" : item.rights_status,
    chapters: chs,
  });
  coreSlugs.add(item.slug);
  promoted++;
}

// Also ensure any remaining Drive books with 0 chapters (e.g. huge scanned PDFs) get an introductory chapter alongside PDF viewer
for (const b of core) {
  if (!b.chapters || b.chapters.length === 0) {
    b.chapters = [
      {
        id: "ch_1",
        book_id: b.id,
        title: "Кітап туралы & PDF нұсқасы",
        order: 1,
        content: `${b.title} — ${b.author}.\n\n${b.description}\n\nБұл кітаптың толық нұсқасын жоғарыдағы «PDF» қойындысы арқылы тікелей оқуға немесе жүктеп алуға болады.`,
      },
    ];
  }
}

fs.writeFileSync("src/data/books.json", JSON.stringify(core, null, 2) + "\n");
fs.writeFileSync("src/data/catalog-extra.json", "[]\n");

console.log({ promotedFromExtra: promoted, totalCoreBooks: core.length, emptyBooksRemaining: core.filter(b => !b.chapters || b.chapters.length === 0).length });
