-- 139_es_fr_a1_extra.sql
-- A1-фундамент (доп. темы) для es/fr: Цвета, Одежда, Тело, Погода, Животные. Идемпотентно.

-- es · colors
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A1','colors',6,'Цвета','🎨',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('el color','цвет',1),
  ('rojo','красный',2),
  ('azul','синий',3),
  ('verde','зелёный',4),
  ('amarillo','жёлтый',5),
  ('negro','чёрный',6),
  ('blanco','белый',7),
  ('naranja','оранжевый',8),
  ('rosa','розовый',9),
  ('gris','серый',10),
  ('marrón','коричневый',11),
  ('morado','фиолетовый',12)
) AS v(word, tr, ord);

-- es · clothes
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A1','clothes',7,'Одежда','👕',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la ropa','одежда',1),
  ('la camiseta','футболка',2),
  ('la camisa','рубашка',3),
  ('el pantalón','брюки',4),
  ('el vestido','платье',5),
  ('la falda','юбка',6),
  ('los zapatos','обувь / туфли',7),
  ('la chaqueta','куртка',8),
  ('el abrigo','пальто',9),
  ('el sombrero','шляпа',10),
  ('los calcetines','носки',11),
  ('los guantes','перчатки',12)
) AS v(word, tr, ord);

-- es · body
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A1','body',8,'Тело','🩺',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('el cuerpo','тело',1),
  ('la cabeza','голова',2),
  ('la mano','рука (кисть)',3),
  ('el brazo','рука',4),
  ('la pierna','нога',5),
  ('el pie','ступня',6),
  ('el ojo','глаз',7),
  ('la boca','рот',8),
  ('la nariz','нос',9),
  ('la oreja','ухо',10),
  ('el pelo','волосы',11),
  ('el corazón','сердце',12)
) AS v(word, tr, ord);

-- es · weather
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A1','weather',9,'Погода','🌤️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('el tiempo','погода',1),
  ('el sol','солнце',2),
  ('la lluvia','дождь',3),
  ('la nieve','снег',4),
  ('el viento','ветер',5),
  ('la nube','облако',6),
  ('el calor','жара',7),
  ('el frío','холод',8),
  ('hace sol','солнечно',9),
  ('hace frío','холодно',10),
  ('hace calor','жарко',11),
  ('llueve','идёт дождь',12)
) AS v(word, tr, ord);

-- es · animals
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A1','animals',10,'Животные','🐶',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('el animal','животное',1),
  ('el perro','собака',2),
  ('el gato','кот / кошка',3),
  ('el caballo','лошадь',4),
  ('el pájaro','птица',5),
  ('el pez','рыба (живая)',6),
  ('la vaca','корова',7),
  ('el cerdo','свинья',8),
  ('la oveja','овца',9),
  ('el ratón','мышь',10),
  ('el oso','медведь',11),
  ('el león','лев',12)
) AS v(word, tr, ord);

-- fr · colors
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A1','colors',6,'Цвета','🎨',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la couleur','цвет',1),
  ('rouge','красный',2),
  ('bleu','синий',3),
  ('vert','зелёный',4),
  ('jaune','жёлтый',5),
  ('noir','чёрный',6),
  ('blanc','белый',7),
  ('orange','оранжевый',8),
  ('rose','розовый',9),
  ('gris','серый',10),
  ('marron','коричневый',11),
  ('violet','фиолетовый',12)
) AS v(word, tr, ord);

-- fr · clothes
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A1','clothes',7,'Одежда','👕',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('les vêtements','одежда',1),
  ('le t-shirt','футболка',2),
  ('la chemise','рубашка',3),
  ('le pantalon','брюки',4),
  ('la robe','платье',5),
  ('la jupe','юбка',6),
  ('les chaussures','обувь',7),
  ('la veste','куртка',8),
  ('le manteau','пальто',9),
  ('le chapeau','шляпа',10),
  ('les chaussettes','носки',11),
  ('les gants','перчатки',12)
) AS v(word, tr, ord);

-- fr · body
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A1','body',8,'Тело','🩺',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('le corps','тело',1),
  ('la tête','голова',2),
  ('la main','рука (кисть)',3),
  ('le bras','рука',4),
  ('la jambe','нога',5),
  ('le pied','ступня',6),
  ('l''œil','глаз',7),
  ('la bouche','рот',8),
  ('le nez','нос',9),
  ('l''oreille','ухо',10),
  ('les cheveux','волосы',11),
  ('le cœur','сердце',12)
) AS v(word, tr, ord);

-- fr · weather
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A1','weather',9,'Погода','🌤️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('le temps','погода',1),
  ('le soleil','солнце',2),
  ('la pluie','дождь',3),
  ('la neige','снег',4),
  ('le vent','ветер',5),
  ('le nuage','облако',6),
  ('la chaleur','жара',7),
  ('le froid','холод',8),
  ('il fait beau','хорошая погода',9),
  ('il fait froid','холодно',10),
  ('il fait chaud','жарко',11),
  ('il pleut','идёт дождь',12)
) AS v(word, tr, ord);

-- fr · animals
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A1','animals',10,'Животные','🐶',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('l''animal','животное',1),
  ('le chien','собака',2),
  ('le chat','кот / кошка',3),
  ('le cheval','лошадь',4),
  ('l''oiseau','птица',5),
  ('la souris','мышь',6),
  ('la vache','корова',7),
  ('le cochon','свинья',8),
  ('le mouton','баран / овца',9),
  ('le lapin','кролик',10),
  ('l''ours','медведь',11),
  ('le lion','лев',12)
) AS v(word, tr, ord);
