-- 137_es_fr_de_a1.sql
-- Контент A1 для испанского, французского, немецкого (5 тем как у en/it).
-- Идемпотентно: снимает CHECK на язык, upsert курсов по UNIQUE(language,level,theme),
-- перезаписывает слова курса (CTE). Повторный запуск безопасен; en/it не трогается.

-- 1) Разрешаем новые языки в CHECK
ALTER TABLE public.language_courses DROP CONSTRAINT IF EXISTS language_courses_language_check;
ALTER TABLE public.language_courses ADD CONSTRAINT language_courses_language_check CHECK (language IN ('en','it','es','de','fr'));

-- 2) Курсы + слова
-- es · greetings
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A1','greetings',1,'Приветствия','👋',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('hola','привет',1),
  ('buenos días','доброе утро',2),
  ('buenas tardes','добрый день',3),
  ('buenas noches','спокойной ночи / добрый вечер',4),
  ('adiós','до свидания',5),
  ('hasta luego','до скорого',6),
  ('por favor','пожалуйста (просьба)',7),
  ('gracias','спасибо',8),
  ('de nada','пожалуйста (в ответ)',9),
  ('sí','да',10),
  ('no','нет',11),
  ('¿cómo estás?','как дела?',12),
  ('perdón','извините',13)
) AS v(word, tr, ord);

-- es · family
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A1','family',2,'Семья','👨‍👩‍👧',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la familia','семья',1),
  ('la madre','мать',2),
  ('el padre','отец',3),
  ('el hijo','сын',4),
  ('la hija','дочь',5),
  ('el hermano','брат',6),
  ('la hermana','сестра',7),
  ('el abuelo','дедушка',8),
  ('la abuela','бабушка',9),
  ('el niño','мальчик / ребёнок',10),
  ('la niña','девочка',11),
  ('el marido','муж',12),
  ('la esposa','жена',13)
) AS v(word, tr, ord);

-- es · food
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A1','food',3,'Еда','🍎',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('el agua','вода',1),
  ('el pan','хлеб',2),
  ('la leche','молоко',3),
  ('el café','кофе',4),
  ('el té','чай',5),
  ('la manzana','яблоко',6),
  ('la carne','мясо',7),
  ('el pescado','рыба',8),
  ('el queso','сыр',9),
  ('el huevo','яйцо',10),
  ('la fruta','фрукт',11),
  ('la verdura','овощ',12),
  ('el azúcar','сахар',13)
) AS v(word, tr, ord);

-- es · numbers
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A1','numbers',4,'Числа','🔢',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('uno','один',1),
  ('dos','два',2),
  ('tres','три',3),
  ('cuatro','четыре',4),
  ('cinco','пять',5),
  ('seis','шесть',6),
  ('siete','семь',7),
  ('ocho','восемь',8),
  ('nueve','девять',9),
  ('diez','десять',10),
  ('cero','ноль',11),
  ('cien','сто',12)
) AS v(word, tr, ord);

-- es · daily
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A1','daily',5,'Бытовое','🏠',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la casa','дом',1),
  ('la puerta','дверь',2),
  ('la ventana','окно',3),
  ('la mesa','стол',4),
  ('la silla','стул',5),
  ('la cama','кровать',6),
  ('el coche','машина',7),
  ('el trabajo','работа',8),
  ('el día','день',9),
  ('la noche','ночь',10),
  ('el libro','книга',11),
  ('el teléfono','телефон',12)
) AS v(word, tr, ord);

-- fr · greetings
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A1','greetings',1,'Приветствия','👋',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('bonjour','здравствуйте / добрый день',1),
  ('salut','привет',2),
  ('bonsoir','добрый вечер',3),
  ('bonne nuit','спокойной ночи',4),
  ('au revoir','до свидания',5),
  ('à bientôt','до скорого',6),
  ('s''il vous plaît','пожалуйста (просьба)',7),
  ('merci','спасибо',8),
  ('de rien','пожалуйста (в ответ)',9),
  ('oui','да',10),
  ('non','нет',11),
  ('comment ça va ?','как дела?',12),
  ('pardon','извините',13)
) AS v(word, tr, ord);

-- fr · family
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A1','family',2,'Семья','👨‍👩‍👧',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la famille','семья',1),
  ('la mère','мать',2),
  ('le père','отец',3),
  ('le fils','сын',4),
  ('la fille','дочь',5),
  ('le frère','брат',6),
  ('la sœur','сестра',7),
  ('le grand-père','дедушка',8),
  ('la grand-mère','бабушка',9),
  ('le garçon','мальчик',10),
  ('la femme','женщина / жена',11),
  ('le mari','муж',12),
  ('l''enfant','ребёнок',13)
) AS v(word, tr, ord);

-- fr · food
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A1','food',3,'Еда','🍎',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('l''eau','вода',1),
  ('le pain','хлеб',2),
  ('le lait','молоко',3),
  ('le café','кофе',4),
  ('le thé','чай',5),
  ('la pomme','яблоко',6),
  ('la viande','мясо',7),
  ('le poisson','рыба',8),
  ('le fromage','сыр',9),
  ('l''œuf','яйцо',10),
  ('le fruit','фрукт',11),
  ('le légume','овощ',12),
  ('le sucre','сахар',13)
) AS v(word, tr, ord);

-- fr · numbers
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A1','numbers',4,'Числа','🔢',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('un','один',1),
  ('deux','два',2),
  ('trois','три',3),
  ('quatre','четыре',4),
  ('cinq','пять',5),
  ('six','шесть',6),
  ('sept','семь',7),
  ('huit','восемь',8),
  ('neuf','девять',9),
  ('dix','десять',10),
  ('zéro','ноль',11),
  ('cent','сто',12)
) AS v(word, tr, ord);

-- fr · daily
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A1','daily',5,'Бытовое','🏠',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la maison','дом',1),
  ('la porte','дверь',2),
  ('la fenêtre','окно',3),
  ('la table','стол',4),
  ('la chaise','стул',5),
  ('le lit','кровать',6),
  ('la voiture','машина',7),
  ('le travail','работа',8),
  ('le jour','день',9),
  ('la nuit','ночь',10),
  ('le livre','книга',11),
  ('le téléphone','телефон',12)
) AS v(word, tr, ord);

-- de · greetings
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A1','greetings',1,'Приветствия','👋',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('hallo','привет',1),
  ('guten Morgen','доброе утро',2),
  ('guten Tag','добрый день',3),
  ('guten Abend','добрый вечер',4),
  ('gute Nacht','спокойной ночи',5),
  ('auf Wiedersehen','до свидания',6),
  ('tschüss','пока',7),
  ('bitte','пожалуйста',8),
  ('danke','спасибо',9),
  ('ja','да',10),
  ('nein','нет',11),
  ('wie geht''s?','как дела?',12),
  ('Entschuldigung','извините',13)
) AS v(word, tr, ord);

-- de · family
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A1','family',2,'Семья','👨‍👩‍👧',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('die Familie','семья',1),
  ('die Mutter','мать',2),
  ('der Vater','отец',3),
  ('der Sohn','сын',4),
  ('die Tochter','дочь',5),
  ('der Bruder','брат',6),
  ('die Schwester','сестра',7),
  ('der Großvater','дедушка',8),
  ('die Großmutter','бабушка',9),
  ('der Junge','мальчик',10),
  ('das Mädchen','девочка',11),
  ('der Mann','мужчина / муж',12),
  ('die Frau','женщина / жена',13),
  ('das Kind','ребёнок',14)
) AS v(word, tr, ord);

-- de · food
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A1','food',3,'Еда','🍎',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('das Wasser','вода',1),
  ('das Brot','хлеб',2),
  ('die Milch','молоко',3),
  ('der Kaffee','кофе',4),
  ('der Tee','чай',5),
  ('der Apfel','яблоко',6),
  ('das Fleisch','мясо',7),
  ('der Fisch','рыба',8),
  ('der Käse','сыр',9),
  ('das Ei','яйцо',10),
  ('das Obst','фрукты',11),
  ('das Gemüse','овощи',12),
  ('der Zucker','сахар',13)
) AS v(word, tr, ord);

-- de · numbers
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A1','numbers',4,'Числа','🔢',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('eins','один',1),
  ('zwei','два',2),
  ('drei','три',3),
  ('vier','четыре',4),
  ('fünf','пять',5),
  ('sechs','шесть',6),
  ('sieben','семь',7),
  ('acht','восемь',8),
  ('neun','девять',9),
  ('zehn','десять',10),
  ('null','ноль',11),
  ('hundert','сто',12)
) AS v(word, tr, ord);

-- de · daily
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A1','daily',5,'Бытовое','🏠',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS (
  DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c)
)
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('das Haus','дом',1),
  ('die Tür','дверь',2),
  ('das Fenster','окно',3),
  ('der Tisch','стол',4),
  ('der Stuhl','стул',5),
  ('das Bett','кровать',6),
  ('das Auto','машина',7),
  ('die Arbeit','работа',8),
  ('der Tag','день',9),
  ('die Nacht','ночь',10),
  ('das Buch','книга',11),
  ('das Telefon','телефон',12)
) AS v(word, tr, ord);
