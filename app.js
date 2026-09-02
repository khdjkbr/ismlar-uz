(function () {
  'use strict';

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const ADMIN_PASSWORD_DEFAULT = "admin2026";

  // Стартовая база (работает сразу, даже если names_data.js ещё не сгенерирован)
  const FALLBACK_NAMES = [
    {"id":1,"k":"Абдулазиз","l":"Abdulaziz","g":"m","lang":"Арабча","m":"Иззат ва эъзоз соҳибининг, яъни Аллоҳнинг қули.","v":1420},
    {"id":2,"k":"Муҳаммад","l":"Muhammad","g":"m","lang":"Арабча","m":"Мақтовга, олқишларга сазовор. Пайғамбаримиз (с.а.в.)нинг муборак исмлари.","v":1850},
    {"id":3,"k":"Алишер","l":"Alisher","g":"m","lang":"Арабча / Форс-тожикча","m":"Шердек жасур, довюрак бўлиб ўссин ва Али қўллаб юрсин.","v":1280},
    {"id":4,"k":"Амирхон","l":"Amirxon","g":"m","lang":"Арабча / Ўзбекча","m":"Ҳоким, йўлбошчи; юксак мартабали, эъзозли ўғил.","v":980},
    {"id":5,"k":"Беҳрўз","l":"Behro‘z","g":"m","lang":"Форс-тожикча","m":"Айнан: бахтли кунлар, яъни бахтли, саодатли кунда туғилган бола.","v":1120},
    {"id":6,"k":"Жавоҳир","l":"Javohir","g":"m","lang":"Арабча","m":"Қимматбаҳо тошлар, жавоҳирлар; бебаҳо, қимматли фарзанд.","v":1150},
    {"id":7,"k":"Сардор","l":"Sardor","g":"m","lang":"Форс-тожикча","m":"Етакчи, бошлиқ, раҳбар; лашкарбоши, йўлбошчи.","v":940},
    {"id":8,"k":"Шерзод","l":"Sherzod","g":"m","lang":"Форс-тожикча","m":"Шер боласи, довюрак, жасурлар авлодига мансуб бола.","v":870},
    {"id":9,"k":"Темур","l":"Temur","g":"m","lang":"Ўзбекча","m":"Темирдек мустаҳкам, маҳкам, чидамли, умри узоқ бола.","v":1050},
    {"id":10,"k":"Имрон","l":"Imron","g":"m","lang":"Арабча","m":"Тириклик, барҳаётлик, узоқ умр кўрувчи, ободлик рамзи.","v":1390},
    {"id":11,"k":"Билол","l":"Bilol","g":"m","lang":"Арабча","m":"Янги туққан ой (ҳилол) ёки соғлом, чанқоқни қондирувчи сувдек азиз бола.","v":920},
    {"id":12,"k":"Даврон","l":"Davron","g":"m","lang":"Арабча","m":"Давр сурсин, умри шодон, бахтиёр ўтсин, толеи порлоқ бўлсин.","v":780},
    {"id":13,"k":"Юсуф","l":"Yusuf","g":"m","lang":"Қадимий яҳудийча / Арабча","m":"Ўсган, кўпайган; ҳуснда тенгсиз, гўзаллик рамзи бўлган бола.","v":1360},
    {"id":14,"k":"Улуғбек","l":"Ulug‘bek","g":"m","lang":"Ўзбекча","m":"Буюк ҳукмдор, буюк султон, бекларнинг энг улуғи.","v":1120},
    {"id":15,"k":"Умар","l":"Umar","g":"m","lang":"Арабча","m":"Барҳаёт, узоқ умр кўрувчи, табаррук ва адолатли инсон.","v":1250},
    {"id":16,"k":"Рустам","l":"Rustam","g":"m","lang":"Форс-тожикча","m":"Улкан гавдали, кучли, довюрак баҳодир, паҳлавон.","v":960},
    {"id":17,"k":"Санжар","l":"Sanjar","g":"m","lang":"Арабча","m":"Шиддатли, ўткир, кучли, ғолиб ва музаффар йигит.","v":820},
    {"id":18,"k":"Ойбек","l":"Oybek","g":"m","lang":"Ўзбекча","m":"Беклар авлодига мансуб, ойдек кўркам ва бахтли бола.","v":880},
    {"id":19,"k":"Отабек","l":"Otabek","g":"m","lang":"Ўзбекча","m":"Шаҳзода, хонзода; беклар бошлиғи, элнинг сардори.","v":850},
    {"id":20,"k":"Жасур","l":"Jasur","g":"m","lang":"Арабча","m":"Қайтмас, мард, журъатли, жасоратли ва довюрак бола.","v":910},
    // Qizlar
    {"id":21,"k":"Мадина","l":"Madina","g":"f","lang":"Арабча","m":"Муқаддас шаҳар, зиёратгоҳ Мадина шаҳри номидан олинган гўзал қиз.","v":1790},
    {"id":22,"k":"Зуҳро","l":"Zuhro","g":"f","lang":"Арабча","m":"Нур, ёрқин, равшан; Чўлпон юлдузидек порлоқ ва гўзал қиз.","v":1350},
    {"id":23,"k":"Ясмина","l":"Yasmina","g":"f","lang":"Арабча / Форс-тожикча","m":"Хушбўй ёсумин (жасмин) гулидек нафис, латофатли ва севимли қиз.","v":1640},
    {"id":24,"k":"Фотима","l":"Fotima","g":"f","lang":"Арабча","m":"Пайғамбаримиз (с.а.в.)нинг суюкли қизларининг муборак исмлари.","v":1510},
    {"id":25,"k":"Райҳона","l":"Rayhona","g":"f","lang":"Арабча","m":"Нозбўй, райҳондек ёқимли, хушбўй ва дилкаш қиз.","v":1470},
    {"id":26,"k":"Муслима","l":"Muslima","g":"f","lang":"Арабча","m":"Мусулмон, художўй, иймонли ва одобли қиз.","v":1310},
    {"id":27,"k":"Самира","l":"Samira","g":"f","lang":"Арабча","m":"Суҳбатдош, дилкаш, ёқимтой ва ширинсўз қиз.","v":1260},
    {"id":28,"k":"Шаҳзода","l":"Shahzoda","g":"f","lang":"Форс-тожикча","m":"Шоҳлар авлодига мансуб, аслзода, маликадек ҳурматли қиз.","v":1040},
    {"id":29,"k":"Ойша","l":"Oysha","g":"f","lang":"Арабча","m":"Яшовчи, барҳаёт, саодатли ва покдомон аёл.","v":1420},
    {"id":30,"k":"Гулнора","l":"Gulnora","g":"f","lang":"Форс-тожикча","m":"Анор гулидек чиройли, чеҳраси қирмизи, гўзал қиз.","v":980},
    {"id":31,"k":"Дилдора","l":"Dildora","g":"f","lang":"Форс-тожикча","m":"Дилдан севилган, чин муҳаббат соҳибаси, дилни ром қилувчи суюкли қиз.","v":950},
    {"id":32,"k":"Лола","l":"Lola","g":"f","lang":"Форс-тожикча","m":"Лоладек яшнаган, гўзал ва баҳорий тароватли қиз.","v":890},
    {"id":33,"k":"Барно","l":"Barno","g":"f","lang":"Форс-тожикча","m":"Ёш, навжувон; чиройли, хушбичим, келишган соҳибжамол.","v":840},
    {"id":34,"k":"Зилола","l":"Zilola","g":"f","lang":"Арабча","m":"Тиниқ булоқ сувидек покиза, тоза ва беғубор қиз.","v":860},
    {"id":35,"k":"Шаҳноза","l":"Shahnoza","g":"f","lang":"Форс-тожикча","m":"Шоҳона нозли, назокатли, латофатли ва олийжаноб қиз.","v":910},
    {"id":36,"k":"Севинч","l":"Sevinch","g":"f","lang":"Ўзбекча","m":"Шодлик, бахтиёрлик, оиланинг севинчи бўлган қиз.","v":1130},
    {"id":37,"k":"Маҳлиё","l":"Mahliyo","g":"f","lang":"Арабча","m":"Сеҳрловчи, жозибали, мафтункор, кўзни қувонтирувчи сулув қиз.","v":940},
    {"id":38,"k":"Нигора","l":"Nigora","g":"f","lang":"Форс-тожикча","m":"Гўзал чеҳрали, соҳибжамол, суюкли ва интизор кутилган қиз.","v":830},
    {"id":39,"k":"Феруза","l":"Feruza","g":"f","lang":"Форс-тожикча","m":"Ғолиб, толеи баланд; фирўза тошидек ноёб, қимматли ва бебаҳо қиз.","v":810},
    {"id":40,"k":"Ҳадича","l":"Hadicha","g":"f","lang":"Арабча","m":"Чақалоқларнинг энг азизи; Пайғамбаримизнинг илк завжалари муборак исмлари.","v":1180}
  ];

  if (!window.ALL_NAMES || !Array.isArray(window.ALL_NAMES) || window.ALL_NAMES.length === 0) {
    window.ALL_NAMES = FALLBACK_NAMES;
  }

  const ALPHABETS = {
    lotin: [
      'A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 
      'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 
      'V', 'X', 'Y', 'Z', 'Oʻ', 'Gʻ', 'Sh', 'Ch'
    ],
    kirill: [
      'А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И', 
      'Й', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 
      'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Ъ', 'Ь', 'Э', 'Ю', 
      'Я', 'Ў', 'Қ', 'Ғ', 'Ҳ'
    ]
  };

  const TRANSLATIONS = {
    lotin: {
      siteTitle: "Ismlar.uz — O'zbek ismlari ma'nosi to'liq katalogi",
      welcomeTitle: "Farzandingiz uchun eng chiroyli va ma'noli ismni tanlang",
      welcomeSub: "12 000+ dan ortiq o'zbek xalq ismlarining to'liq ma'nosi, kelib chiqishi va izohi.",
      chooseAlifbo: "Dastlab o'zingizga qulay alifboni tanlang:",
      stage2Badge: "2-bosqich",
      genderTitle: "Farzandingiz jinsini tanlang",
      genderDesc: "Tanlovingizga ko'ra mos ismlar saralab beriladi",
      lblBoy: "O'g'il bola",
      lblBoySub: "Jasur, mard, baxtli",
      lblGirl: "Qiz bola",
      lblGirlSub: "Go'zal, latofatli, oqila",
      alphabetHeading: "Harf bo'yicha ismlar",
      alphabetHint: "Bosh harfni tanlang:",
      searchPlaceholder: "Ism bo'yicha tezkor qidiruv...",
      searchResHeading: "Qidiruv natijalari",
      top10Title: "Eng ko'p ko'rilgan 10 ta ism",
      top10BoyBadge: "O'g'il bolalar uchun",
      top10GirlBadge: "Qiz bolalar uchun",
      liveViewsNote: "Haqiqiy foydalanuvchilar ko'rishlari asosida",
      altScriptLabel: "Kirillcha yozilishi:",
      originLabel: "Kelib chiqishi:",
      genderBoyTag: "O'g'il bola",
      genderGirlTag: "Qiz bola",
      copiedText: "Ism ma'lumoti nusxalandi!",
      noNamesFound: "Bu bo'limda ismlar topilmadi",
      letterTitleSuffix: "harfi bilan boshlanuvchi ismlar",
      itemsFound: "ta ism topildi",
      footerRef: "Manba: E. A. Begmatovning «O'zbek ismlari ma'nosi» fundamental kitobi asosida.",
      favTitle: "Sevimlilar ro'yxati",
      favHeaderBtn: "Sevimlilar",
      favBannerText: "⏳ Ismlar ushbu qurilmada ro'yxatdan o'tmasdan <b>7 kun</b> saqlanadi.",
      favEmpty: "Hozircha sevimli ismlar yo'q. Istalgan ism yonidagi yurakcha (🤍) tugmasini bosing.",
      daysLeft: "kun qoldi",
      hoursLeft: "soat qoldi"
    },
    kirill: {
      siteTitle: "Ismlar.uz — Ўзбек исмлари маъноси тўлиқ каталоги",
      welcomeTitle: "Фарзандингиз учун энг чиройли ва маъноли исмни танланг",
      welcomeSub: "12 000+ дан ортиқ ўзбек халқ исмларининг тўлиқ маъноси, келиб чиқиши ва изоҳи.",
      chooseAlifbo: "Дастлаб ўзингизга қулай алифбони танланг:",
      stage2Badge: "2-босқич",
      genderTitle: "Фарзандингиз жинсини танланг",
      genderDesc: "Танловингизга кўра мос исмлар саралаб берилади",
      lblBoy: "Ўғил бола",
      lblBoySub:
