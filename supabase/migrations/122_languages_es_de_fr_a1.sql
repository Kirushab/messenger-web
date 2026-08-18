-- 122_languages_es_de_fr_a1.sql
-- Стартовый контент A1 для испанского, немецкого, французского.
-- Сгенерировано scripts/gen-lang-seed.mjs. Идемпотентно (можно гонять повторно).
-- Формат — см. docs/CONTENT_LANGUAGES.md.

-- Расширяем CHECK на language: было IN ('en','it'), добавляем es/de/fr.
ALTER TABLE public.language_courses DROP CONSTRAINT IF EXISTS language_courses_language_check;
ALTER TABLE public.language_courses ADD  CONSTRAINT language_courses_language_check CHECK (language IN ('en','it','es','de','fr'));
ALTER TABLE public.language_passages DROP CONSTRAINT IF EXISTS language_passages_language_check;
ALTER TABLE public.language_passages ADD  CONSTRAINT language_passages_language_check CHECK (language IN ('en','it','es','de','fr'));
ALTER TABLE public.grammar_items DROP CONSTRAINT IF EXISTS grammar_items_language_check;
ALTER TABLE public.grammar_items ADD  CONSTRAINT grammar_items_language_check CHECK (language IN ('en','it','es','de','fr'));

INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru) VALUES
  ('es', 'A1', 'greetings', 1, 'Приветствия', '👋', 'Здороваемся и прощаемся'),
  ('es', 'A1', 'family', 2, 'Семья', '👨‍👩‍👧', 'Мама, папа, брат, сестра'),
  ('es', 'A1', 'food', 3, 'Еда', '🍞', 'Хлеб, вода, яблоко'),
  ('es', 'A1', 'numbers', 4, 'Числа', '🔢', 'От одного до десяти'),
  ('es', 'A1', 'daily', 5, 'Бытовое', '🏠', 'Дом, день, ночь, работа'),
  ('de', 'A1', 'greetings', 1, 'Приветствия', '👋', 'Здороваемся и прощаемся'),
  ('de', 'A1', 'family', 2, 'Семья', '👨‍👩‍👧', 'Мама, папа, брат, сестра'),
  ('de', 'A1', 'food', 3, 'Еда', '🍞', 'Хлеб, вода, яблоко'),
  ('de', 'A1', 'numbers', 4, 'Числа', '🔢', 'От одного до десяти'),
  ('de', 'A1', 'daily', 5, 'Бытовое', '🏠', 'Дом, день, ночь, работа'),
  ('fr', 'A1', 'greetings', 1, 'Приветствия', '👋', 'Здороваемся и прощаемся'),
  ('fr', 'A1', 'family', 2, 'Семья', '👨‍👩‍👧', 'Мама, папа, брат, сестра'),
  ('fr', 'A1', 'food', 3, 'Еда', '🍞', 'Хлеб, вода, яблоко'),
  ('fr', 'A1', 'numbers', 4, 'Числа', '🔢', 'От одного до десяти'),
  ('fr', 'A1', 'daily', 5, 'Бытовое', '🏠', 'Дом, день, ночь, работа')
ON CONFLICT (language, level, theme) DO UPDATE SET
  order_index = EXCLUDED.order_index, title_ru = EXCLUDED.title_ru,
  icon = EXCLUDED.icon, description_ru = EXCLUDED.description_ru;

-- чистим прежние слова этих курсов, чтобы миграция была идемпотентной
DELETE FROM public.language_words WHERE course_id IN (
  SELECT id FROM public.language_courses WHERE language IN ('es','de','fr') AND level = 'A1'
);

-- es · greetings
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('hola', 'привет', '¡Hola! ¿Cómo estás?', 'Привет! Как дела?', 1),
    ('adiós', 'пока', '¡Adiós, hasta luego!', 'Пока, до встречи!', 2),
    ('gracias', 'спасибо', 'Muchas gracias.', 'Большое спасибо.', 3),
    ('por favor', 'пожалуйста', 'Un café, por favor.', 'Кофе, пожалуйста.', 4),
    ('sí', 'да', 'Sí, claro.', 'Да, конечно.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'es' AND c.level = 'A1' AND c.theme = 'greetings';

-- es · family
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('madre', 'мама', 'Mi madre es profesora.', 'Моя мама — учительница.', 1),
    ('padre', 'папа', 'Mi padre trabaja mucho.', 'Мой папа много работает.', 2),
    ('hermano', 'брат', 'Tengo un hermano.', 'У меня есть брат.', 3),
    ('hermana', 'сестра', 'Mi hermana es pequeña.', 'Моя сестра маленькая.', 4),
    ('familia', 'семья', 'Amo a mi familia.', 'Я люблю свою семью.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'es' AND c.level = 'A1' AND c.theme = 'family';

-- es · food
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('pan', 'хлеб', 'Quiero pan, por favor.', 'Я хочу хлеб, пожалуйста.', 1),
    ('agua', 'вода', 'Un vaso de agua.', 'Стакан воды.', 2),
    ('manzana', 'яблоко', 'Como una manzana.', 'Я ем яблоко.', 3),
    ('leche', 'молоко', 'Café con leche.', 'Кофе с молоком.', 4),
    ('café', 'кофе', 'Me gusta el café.', 'Мне нравится кофе.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'es' AND c.level = 'A1' AND c.theme = 'food';

-- es · numbers
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('uno', 'один', 'Tengo uno.', 'У меня есть один.', 1),
    ('dos', 'два', 'Son las dos.', 'Сейчас два часа.', 2),
    ('tres', 'три', 'Tres amigos.', 'Три друга.', 3),
    ('cuatro', 'четыре', 'Cuatro gatos.', 'Четыре кота.', 4),
    ('cinco', 'пять', 'Cinco minutos.', 'Пять минут.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'es' AND c.level = 'A1' AND c.theme = 'numbers';

-- es · daily
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('casa', 'дом', 'Estoy en casa.', 'Я дома.', 1),
    ('día', 'день', 'Buen día.', 'Добрый день.', 2),
    ('noche', 'ночь', 'Buenas noches.', 'Спокойной ночи.', 3),
    ('trabajo', 'работа', 'Voy al trabajo.', 'Я иду на работу.', 4),
    ('amigo', 'друг', 'Es mi amigo.', 'Это мой друг.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'es' AND c.level = 'A1' AND c.theme = 'daily';

-- de · greetings
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('hallo', 'привет', 'Hallo! Wie geht es dir?', 'Привет! Как дела?', 1),
    ('tschüss', 'пока', 'Tschüss, bis bald!', 'Пока, до скорого!', 2),
    ('danke', 'спасибо', 'Danke schön.', 'Большое спасибо.', 3),
    ('bitte', 'пожалуйста', 'Einen Kaffee, bitte.', 'Кофе, пожалуйста.', 4),
    ('ja', 'да', 'Ja, gern.', 'Да, с удовольствием.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'de' AND c.level = 'A1' AND c.theme = 'greetings';

-- de · family
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('Mutter', 'мама', 'Meine Mutter kocht gut.', 'Моя мама хорошо готовит.', 1),
    ('Vater', 'папа', 'Mein Vater liest gern.', 'Мой папа любит читать.', 2),
    ('Bruder', 'брат', 'Ich habe einen Bruder.', 'У меня есть брат.', 3),
    ('Schwester', 'сестра', 'Meine Schwester ist klein.', 'Моя сестра маленькая.', 4),
    ('Familie', 'семья', 'Ich liebe meine Familie.', 'Я люблю свою семью.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'de' AND c.level = 'A1' AND c.theme = 'family';

-- de · food
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('Brot', 'хлеб', 'Ich esse Brot.', 'Я ем хлеб.', 1),
    ('Wasser', 'вода', 'Ein Glas Wasser.', 'Стакан воды.', 2),
    ('Apfel', 'яблоко', 'Ein roter Apfel.', 'Красное яблоко.', 3),
    ('Milch', 'молоко', 'Kaffee mit Milch.', 'Кофе с молоком.', 4),
    ('Kaffee', 'кофе', 'Ich trinke Kaffee.', 'Я пью кофе.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'de' AND c.level = 'A1' AND c.theme = 'food';

-- de · numbers
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('eins', 'один', 'Nummer eins.', 'Номер один.', 1),
    ('zwei', 'два', 'Es ist zwei Uhr.', 'Сейчас два часа.', 2),
    ('drei', 'три', 'Drei Freunde.', 'Три друга.', 3),
    ('vier', 'четыре', 'Vier Katzen.', 'Четыре кота.', 4),
    ('fünf', 'пять', 'Fünf Minuten.', 'Пять минут.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'de' AND c.level = 'A1' AND c.theme = 'numbers';

-- de · daily
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('Haus', 'дом', 'Das ist mein Haus.', 'Это мой дом.', 1),
    ('Tag', 'день', 'Schönen Tag!', 'Хорошего дня!', 2),
    ('Nacht', 'ночь', 'Gute Nacht.', 'Спокойной ночи.', 3),
    ('Arbeit', 'работа', 'Ich gehe zur Arbeit.', 'Я иду на работу.', 4),
    ('Freund', 'друг', 'Er ist mein Freund.', 'Он мой друг.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'de' AND c.level = 'A1' AND c.theme = 'daily';

-- fr · greetings
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('bonjour', 'здравствуйте', 'Bonjour, ça va ?', 'Здравствуйте, как дела?', 1),
    ('au revoir', 'до свидания', 'Au revoir, à bientôt !', 'До свидания, до скорого!', 2),
    ('merci', 'спасибо', 'Merci beaucoup.', 'Большое спасибо.', 3),
    ('s''il vous plaît', 'пожалуйста', 'Un café, s''il vous plaît.', 'Кофе, пожалуйста.', 4),
    ('oui', 'да', 'Oui, bien sûr.', 'Да, конечно.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'fr' AND c.level = 'A1' AND c.theme = 'greetings';

-- fr · family
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('mère', 'мама', 'Ma mère est gentille.', 'Моя мама добрая.', 1),
    ('père', 'папа', 'Mon père travaille.', 'Мой папа работает.', 2),
    ('frère', 'брат', 'J''ai un frère.', 'У меня есть брат.', 3),
    ('sœur', 'сестра', 'Ma sœur est petite.', 'Моя сестра маленькая.', 4),
    ('famille', 'семья', 'J''aime ma famille.', 'Я люблю свою семью.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'fr' AND c.level = 'A1' AND c.theme = 'family';

-- fr · food
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('pain', 'хлеб', 'Je mange du pain.', 'Я ем хлеб.', 1),
    ('eau', 'вода', 'Un verre d''eau.', 'Стакан воды.', 2),
    ('pomme', 'яблоко', 'Une pomme rouge.', 'Красное яблоко.', 3),
    ('lait', 'молоко', 'Café au lait.', 'Кофе с молоком.', 4),
    ('café', 'кофе', 'J''aime le café.', 'Я люблю кофе.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'fr' AND c.level = 'A1' AND c.theme = 'food';

-- fr · numbers
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('un', 'один', 'J''ai un chat.', 'У меня есть кот.', 1),
    ('deux', 'два', 'Il est deux heures.', 'Сейчас два часа.', 2),
    ('trois', 'три', 'Trois amis.', 'Три друга.', 3),
    ('quatre', 'четыре', 'Quatre chats.', 'Четыре кота.', 4),
    ('cinq', 'пять', 'Cinq minutes.', 'Пять минут.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'fr' AND c.level = 'A1' AND c.theme = 'numbers';

-- fr · daily
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord
FROM public.language_courses c,
  (VALUES
    ('maison', 'дом', 'Je suis à la maison.', 'Я дома.', 1),
    ('jour', 'день', 'Bonne journée !', 'Хорошего дня!', 2),
    ('nuit', 'ночь', 'Bonne nuit.', 'Спокойной ночи.', 3),
    ('travail', 'работа', 'Je vais au travail.', 'Я иду на работу.', 4),
    ('ami', 'друг', 'C''est mon ami.', 'Это мой друг.', 5)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'fr' AND c.level = 'A1' AND c.theme = 'daily';

