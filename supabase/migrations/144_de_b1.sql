-- 144_de_b1.sql
-- Немецкий B1: Мнение, Природа, Технологии, Здоровье, Образование, Характер. Идемпотентно.

-- de · opinions
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','B1','opinions',1,'Мнение и беседа','💭',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('die Meinung','мнение',1),
  ('glauben','считать / верить',2),
  ('denken','думать',3),
  ('einverstanden sein','соглашаться',4),
  ('vielleicht','возможно',5),
  ('weil','потому что',6),
  ('aber','но',7),
  ('auch','тоже',8),
  ('trotzdem','однако / тем не менее',9),
  ('zum Beispiel','например',10),
  ('meiner Meinung nach','по-моему',11),
  ('der Grund','причина',12),
  ('die Idee','идея',13)
) AS v(word, tr, ord);

-- de · nature
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','B1','nature',2,'Природа','🌳',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('die Natur','природа',1),
  ('der Baum','дерево',2),
  ('die Blume','цветок',3),
  ('der Fluss','река',4),
  ('das Meer','море',5),
  ('der Berg','гора',6),
  ('der Wald','лес',7),
  ('der Himmel','небо',8),
  ('die Erde','земля',9),
  ('der Strand','пляж',10),
  ('der See','озеро',11),
  ('das Blatt','лист',12),
  ('der Stein','камень',13)
) AS v(word, tr, ord);

-- de · technology
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','B1','technology',3,'Технологии и интернет','💻',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('die Technik','техника / технология',1),
  ('der Computer','компьютер',2),
  ('das Internet','интернет',3),
  ('die E-Mail','электронная почта',4),
  ('das Passwort','пароль',5),
  ('der Bildschirm','экран',6),
  ('die Datei','файл',7),
  ('die App','приложение',8),
  ('das Netzwerk','сеть',9),
  ('herunterladen','скачивать',10),
  ('die Nachricht','сообщение',11),
  ('die Kamera','камера',12),
  ('der Benutzer','пользователь',13)
) AS v(word, tr, ord);

-- de · health
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','B1','health',4,'Здоровье','🏥',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('die Gesundheit','здоровье',1),
  ('die Krankheit','болезнь',2),
  ('das Fieber','температура / жар',3),
  ('der Husten','кашель',4),
  ('die Erkältung','простуда',5),
  ('das Rezept','рецепт',6),
  ('der Termin','приём (запись)',7),
  ('das Symptom','симптом',8),
  ('gesund','здоровый',9),
  ('die Wunde','рана',10),
  ('die Tablette','таблетка',11),
  ('der Zahnarzt','стоматолог',12),
  ('sich ausruhen','отдыхать',13)
) AS v(word, tr, ord);

-- de · education
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','B1','education',5,'Образование','🎓',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('die Bildung','образование',1),
  ('die Universität','университет',2),
  ('die Prüfung','экзамен',3),
  ('der Unterricht','урок / занятие',4),
  ('der Schüler','ученик',5),
  ('die Hausaufgabe','домашнее задание',6),
  ('lernen','учиться / изучать',7),
  ('unterrichten','преподавать',8),
  ('die Note','оценка',9),
  ('die Sprache','язык',10),
  ('die Frage','вопрос',11),
  ('die Antwort','ответ',12),
  ('studieren','учиться (в вузе)',13)
) AS v(word, tr, ord);

-- de · character
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','B1','character',6,'Характер и эмоции','🧠',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('der Charakter','характер',1),
  ('nett','добрый / милый',2),
  ('freundlich','приветливый',3),
  ('intelligent','умный',4),
  ('schüchtern','застенчивый',5),
  ('fleißig','трудолюбивый',6),
  ('ehrlich','честный',7),
  ('großzügig','щедрый',8),
  ('mutig','смелый',9),
  ('ruhig','спокойный',10),
  ('lustig','весёлый',11),
  ('ernst','серьёзный',12),
  ('faul','ленивый',13)
) AS v(word, tr, ord);
