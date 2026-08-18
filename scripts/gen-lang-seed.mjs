// Генерирует supabase/migrations/122_languages_es_de_fr_a1.sql из структуры ниже.
// Запуск: node scripts/gen-lang-seed.mjs
import { writeFileSync } from 'node:fs';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`; // экранирование апострофов для SQL

const THEMES = [
  { theme: 'greetings', order: 1, title: 'Приветствия', icon: '👋', desc: 'Здороваемся и прощаемся' },
  { theme: 'family',    order: 2, title: 'Семья',       icon: '👨‍👩‍👧', desc: 'Мама, папа, брат, сестра' },
  { theme: 'food',      order: 3, title: 'Еда',         icon: '🍞', desc: 'Хлеб, вода, яблоко' },
  { theme: 'numbers',   order: 4, title: 'Числа',       icon: '🔢', desc: 'От одного до десяти' },
  { theme: 'daily',     order: 5, title: 'Бытовое',     icon: '🏠', desc: 'Дом, день, ночь, работа' },
];

// [word, перевод, пример, пример_ru]
const V = {
  es: {
    greetings: [
      ['hola', 'привет', '¡Hola! ¿Cómo estás?', 'Привет! Как дела?'],
      ['adiós', 'пока', '¡Adiós, hasta luego!', 'Пока, до встречи!'],
      ['gracias', 'спасибо', 'Muchas gracias.', 'Большое спасибо.'],
      ['por favor', 'пожалуйста', 'Un café, por favor.', 'Кофе, пожалуйста.'],
      ['sí', 'да', 'Sí, claro.', 'Да, конечно.'],
    ],
    family: [
      ['madre', 'мама', 'Mi madre es profesora.', 'Моя мама — учительница.'],
      ['padre', 'папа', 'Mi padre trabaja mucho.', 'Мой папа много работает.'],
      ['hermano', 'брат', 'Tengo un hermano.', 'У меня есть брат.'],
      ['hermana', 'сестра', 'Mi hermana es pequeña.', 'Моя сестра маленькая.'],
      ['familia', 'семья', 'Amo a mi familia.', 'Я люблю свою семью.'],
    ],
    food: [
      ['pan', 'хлеб', 'Quiero pan, por favor.', 'Я хочу хлеб, пожалуйста.'],
      ['agua', 'вода', 'Un vaso de agua.', 'Стакан воды.'],
      ['manzana', 'яблоко', 'Como una manzana.', 'Я ем яблоко.'],
      ['leche', 'молоко', 'Café con leche.', 'Кофе с молоком.'],
      ['café', 'кофе', 'Me gusta el café.', 'Мне нравится кофе.'],
    ],
    numbers: [
      ['uno', 'один', 'Tengo uno.', 'У меня есть один.'],
      ['dos', 'два', 'Son las dos.', 'Сейчас два часа.'],
      ['tres', 'три', 'Tres amigos.', 'Три друга.'],
      ['cuatro', 'четыре', 'Cuatro gatos.', 'Четыре кота.'],
      ['cinco', 'пять', 'Cinco minutos.', 'Пять минут.'],
    ],
    daily: [
      ['casa', 'дом', 'Estoy en casa.', 'Я дома.'],
      ['día', 'день', 'Buen día.', 'Добрый день.'],
      ['noche', 'ночь', 'Buenas noches.', 'Спокойной ночи.'],
      ['trabajo', 'работа', 'Voy al trabajo.', 'Я иду на работу.'],
      ['amigo', 'друг', 'Es mi amigo.', 'Это мой друг.'],
    ],
  },
  de: {
    greetings: [
      ['hallo', 'привет', 'Hallo! Wie geht es dir?', 'Привет! Как дела?'],
      ['tschüss', 'пока', 'Tschüss, bis bald!', 'Пока, до скорого!'],
      ['danke', 'спасибо', 'Danke schön.', 'Большое спасибо.'],
      ['bitte', 'пожалуйста', 'Einen Kaffee, bitte.', 'Кофе, пожалуйста.'],
      ['ja', 'да', 'Ja, gern.', 'Да, с удовольствием.'],
    ],
    family: [
      ['Mutter', 'мама', 'Meine Mutter kocht gut.', 'Моя мама хорошо готовит.'],
      ['Vater', 'папа', 'Mein Vater liest gern.', 'Мой папа любит читать.'],
      ['Bruder', 'брат', 'Ich habe einen Bruder.', 'У меня есть брат.'],
      ['Schwester', 'сестра', 'Meine Schwester ist klein.', 'Моя сестра маленькая.'],
      ['Familie', 'семья', 'Ich liebe meine Familie.', 'Я люблю свою семью.'],
    ],
    food: [
      ['Brot', 'хлеб', 'Ich esse Brot.', 'Я ем хлеб.'],
      ['Wasser', 'вода', 'Ein Glas Wasser.', 'Стакан воды.'],
      ['Apfel', 'яблоко', 'Ein roter Apfel.', 'Красное яблоко.'],
      ['Milch', 'молоко', 'Kaffee mit Milch.', 'Кофе с молоком.'],
      ['Kaffee', 'кофе', 'Ich trinke Kaffee.', 'Я пью кофе.'],
    ],
    numbers: [
      ['eins', 'один', 'Nummer eins.', 'Номер один.'],
      ['zwei', 'два', 'Es ist zwei Uhr.', 'Сейчас два часа.'],
      ['drei', 'три', 'Drei Freunde.', 'Три друга.'],
      ['vier', 'четыре', 'Vier Katzen.', 'Четыре кота.'],
      ['fünf', 'пять', 'Fünf Minuten.', 'Пять минут.'],
    ],
    daily: [
      ['Haus', 'дом', 'Das ist mein Haus.', 'Это мой дом.'],
      ['Tag', 'день', 'Schönen Tag!', 'Хорошего дня!'],
      ['Nacht', 'ночь', 'Gute Nacht.', 'Спокойной ночи.'],
      ['Arbeit', 'работа', 'Ich gehe zur Arbeit.', 'Я иду на работу.'],
      ['Freund', 'друг', 'Er ist mein Freund.', 'Он мой друг.'],
    ],
  },
  fr: {
    greetings: [
      ['bonjour', 'здравствуйте', 'Bonjour, ça va ?', 'Здравствуйте, как дела?'],
      ['au revoir', 'до свидания', 'Au revoir, à bientôt !', 'До свидания, до скорого!'],
      ['merci', 'спасибо', 'Merci beaucoup.', 'Большое спасибо.'],
      ["s'il vous plaît", 'пожалуйста', "Un café, s'il vous plaît.", 'Кофе, пожалуйста.'],
      ['oui', 'да', 'Oui, bien sûr.', 'Да, конечно.'],
    ],
    family: [
      ['mère', 'мама', 'Ma mère est gentille.', 'Моя мама добрая.'],
      ['père', 'папа', 'Mon père travaille.', 'Мой папа работает.'],
      ['frère', 'брат', "J'ai un frère.", 'У меня есть брат.'],
      ['sœur', 'сестра', 'Ma sœur est petite.', 'Моя сестра маленькая.'],
      ['famille', 'семья', "J'aime ma famille.", 'Я люблю свою семью.'],
    ],
    food: [
      ['pain', 'хлеб', 'Je mange du pain.', 'Я ем хлеб.'],
      ['eau', 'вода', "Un verre d'eau.", 'Стакан воды.'],
      ['pomme', 'яблоко', 'Une pomme rouge.', 'Красное яблоко.'],
      ['lait', 'молоко', 'Café au lait.', 'Кофе с молоком.'],
      ['café', 'кофе', "J'aime le café.", 'Я люблю кофе.'],
    ],
    numbers: [
      ['un', 'один', "J'ai un chat.", 'У меня есть кот.'],
      ['deux', 'два', 'Il est deux heures.', 'Сейчас два часа.'],
      ['trois', 'три', 'Trois amis.', 'Три друга.'],
      ['quatre', 'четыре', 'Quatre chats.', 'Четыре кота.'],
      ['cinq', 'пять', 'Cinq minutes.', 'Пять минут.'],
    ],
    daily: [
      ['maison', 'дом', 'Je suis à la maison.', 'Я дома.'],
      ['jour', 'день', 'Bonne journée !', 'Хорошего дня!'],
      ['nuit', 'ночь', 'Bonne nuit.', 'Спокойной ночи.'],
      ['travail', 'работа', 'Je vais au travail.', 'Я иду на работу.'],
      ['ami', 'друг', "C'est mon ami.", 'Это мой друг.'],
    ],
  },
};

const LANGS = ['es', 'de', 'fr'];
let out = '';
out += '-- 122_languages_es_de_fr_a1.sql\n';
out += '-- Стартовый контент A1 для испанского, немецкого, французского.\n';
out += '-- Сгенерировано scripts/gen-lang-seed.mjs. Идемпотентно (можно гонять повторно).\n';
out += '-- Формат — см. docs/CONTENT_LANGUAGES.md.\n\n';

// 0) Расширяем CHECK (language) на es/de/fr (раньше было только en/it) — иначе INSERT падает.
out += "-- Расширяем CHECK на language: было IN ('en','it'), добавляем es/de/fr.\n";
for (const tbl of ['language_courses', 'language_passages', 'grammar_items']) {
  out += `ALTER TABLE public.${tbl} DROP CONSTRAINT IF EXISTS ${tbl}_language_check;\n`;
  out += `ALTER TABLE public.${tbl} ADD  CONSTRAINT ${tbl}_language_check CHECK (language IN ('en','it','es','de','fr'));\n`;
}
out += '\n';

// 1) Курсы (темы)
out += 'INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru) VALUES\n';
const courseRows = [];
for (const lang of LANGS) {
  for (const t of THEMES) {
    courseRows.push(`  (${q(lang)}, 'A1', ${q(t.theme)}, ${t.order}, ${q(t.title)}, ${q(t.icon)}, ${q(t.desc)})`);
  }
}
out += courseRows.join(',\n') + '\n';
out += 'ON CONFLICT (language, level, theme) DO UPDATE SET\n';
out += '  order_index = EXCLUDED.order_index, title_ru = EXCLUDED.title_ru,\n';
out += '  icon = EXCLUDED.icon, description_ru = EXCLUDED.description_ru;\n\n';

// 2) Чистим слова этих курсов (для повторного прогона)
out += '-- чистим прежние слова этих курсов, чтобы миграция была идемпотентной\n';
out += "DELETE FROM public.language_words WHERE course_id IN (\n";
out += "  SELECT id FROM public.language_courses WHERE language IN ('es','de','fr') AND level = 'A1'\n);\n\n";

// 3) Слова по темам
for (const lang of LANGS) {
  for (const t of THEMES) {
    const words = V[lang][t.theme];
    out += `-- ${lang} · ${t.theme}\n`;
    out += 'INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)\n';
    out += 'SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord\n';
    out += 'FROM public.language_courses c,\n  (VALUES\n';
    const valRows = words.map((row, i) =>
      `    (${q(row[0])}, ${q(row[1])}, ${q(row[2])}, ${q(row[3])}, ${i + 1})`
    );
    out += valRows.join(',\n') + '\n';
    out += '  ) AS w(word, tr, ex, ex_ru, ord)\n';
    out += `WHERE c.language = ${q(lang)} AND c.level = 'A1' AND c.theme = ${q(t.theme)};\n\n`;
  }
}

writeFileSync('supabase/migrations/122_languages_es_de_fr_a1.sql', out);
const wordCount = LANGS.reduce((n, l) => n + THEMES.reduce((m, t) => m + V[l][t.theme].length, 0), 0);
console.log(`Записан 122_languages_es_de_fr_a1.sql: ${LANGS.length} языка × ${THEMES.length} тем, слов всего: ${wordCount}`);
