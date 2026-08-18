-- 142_de_a1_extra.sql
-- A1-доп для немецкого: Цвета, Одежда, Тело, Погода, Животные. Идемпотентно.

-- de · colors
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A1','colors',6,'Цвета','🎨',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('die Farbe','цвет',1),
  ('rot','красный',2),
  ('blau','синий',3),
  ('grün','зелёный',4),
  ('gelb','жёлтый',5),
  ('schwarz','чёрный',6),
  ('weiß','белый',7),
  ('orange','оранжевый',8),
  ('rosa','розовый',9),
  ('grau','серый',10),
  ('braun','коричневый',11),
  ('lila','фиолетовый',12)
) AS v(word, tr, ord);

-- de · clothes
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A1','clothes',7,'Одежда','👕',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('die Kleidung','одежда',1),
  ('das T-Shirt','футболка',2),
  ('das Hemd','рубашка',3),
  ('die Hose','брюки',4),
  ('das Kleid','платье',5),
  ('der Rock','юбка',6),
  ('die Schuhe','обувь',7),
  ('die Jacke','куртка',8),
  ('der Mantel','пальто',9),
  ('der Hut','шляпа',10),
  ('die Socken','носки',11),
  ('die Handschuhe','перчатки',12)
) AS v(word, tr, ord);

-- de · body
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A1','body',8,'Тело','🩺',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('der Körper','тело',1),
  ('der Kopf','голова',2),
  ('die Hand','рука (кисть)',3),
  ('der Arm','рука',4),
  ('das Bein','нога',5),
  ('der Fuß','ступня',6),
  ('das Auge','глаз',7),
  ('der Mund','рот',8),
  ('die Nase','нос',9),
  ('das Ohr','ухо',10),
  ('das Haar','волосы',11),
  ('das Herz','сердце',12)
) AS v(word, tr, ord);

-- de · weather
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A1','weather',9,'Погода','🌤️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('das Wetter','погода',1),
  ('die Sonne','солнце',2),
  ('der Regen','дождь',3),
  ('der Schnee','снег',4),
  ('der Wind','ветер',5),
  ('die Wolke','облако',6),
  ('die Hitze','жара',7),
  ('die Kälte','холод',8),
  ('es ist sonnig','солнечно',9),
  ('es ist kalt','холодно',10),
  ('es ist warm','тепло',11),
  ('es regnet','идёт дождь',12)
) AS v(word, tr, ord);

-- de · animals
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A1','animals',10,'Животные','🐶',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('das Tier','животное',1),
  ('der Hund','собака',2),
  ('die Katze','кошка',3),
  ('das Pferd','лошадь',4),
  ('der Vogel','птица',5),
  ('die Maus','мышь',6),
  ('die Kuh','корова',7),
  ('das Schwein','свинья',8),
  ('das Schaf','овца',9),
  ('der Hase','заяц / кролик',10),
  ('der Bär','медведь',11),
  ('der Löwe','лев',12)
) AS v(word, tr, ord);
