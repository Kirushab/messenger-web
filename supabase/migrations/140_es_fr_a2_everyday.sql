-- 140_es_fr_a2_everyday.sql
-- A2-быт для es/fr: Дом, Город, Работа, Хобби, Чувства, Глаголы. Идемпотентно.

-- es · house
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','house',9,'Дом и мебель','🛋️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('el dormitorio','спальня',1),
  ('la cocina','кухня',2),
  ('el salón','гостиная',3),
  ('el cuarto de baño','ванная комната',4),
  ('el sofá','диван',5),
  ('el armario','шкаф',6),
  ('la nevera','холодильник',7),
  ('la lámpara','лампа',8),
  ('el espejo','зеркало',9),
  ('la pared','стена',10),
  ('el suelo','пол',11),
  ('el techo','потолок',12),
  ('el jardín','сад',13)
) AS v(word, tr, ord);

-- es · city
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','city',10,'Город и места','🏙️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la ciudad','город',1),
  ('el pueblo','посёлок / деревня',2),
  ('el banco','банк',3),
  ('el correo','почта',4),
  ('el museo','музей',5),
  ('el parque','парк',6),
  ('la iglesia','церковь',7),
  ('la biblioteca','библиотека',8),
  ('la escuela','школа',9),
  ('el cine','кинотеатр',10),
  ('el puente','мост',11),
  ('el supermercado','супермаркет',12),
  ('el edificio','здание',13)
) AS v(word, tr, ord);

-- es · work
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','work',11,'Работа и профессии','💼',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la profesión','профессия',1),
  ('el profesor','учитель',2),
  ('el estudiante','студент',3),
  ('el ingeniero','инженер',4),
  ('el cocinero','повар',5),
  ('el conductor','водитель',6),
  ('el policía','полицейский',7),
  ('el vendedor','продавец',8),
  ('el jefe','начальник',9),
  ('la oficina','офис',10),
  ('la empresa','компания',11),
  ('el sueldo','зарплата',12),
  ('la reunión','совещание',13)
) AS v(word, tr, ord);

-- es · hobbies
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','hobbies',12,'Хобби и досуг','⚽',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('el deporte','спорт',1),
  ('la música','музыка',2),
  ('la película','фильм',3),
  ('la lectura','чтение',4),
  ('el fútbol','футбол',5),
  ('la natación','плавание',6),
  ('el baile','танцы',7),
  ('el viaje','путешествие',8),
  ('la foto','фото',9),
  ('el juego','игра',10),
  ('la pintura','рисование',11),
  ('el tiempo libre','свободное время',12),
  ('la fiesta','праздник / вечеринка',13)
) AS v(word, tr, ord);

-- es · feelings
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','feelings',13,'Чувства и качества','😊',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('feliz','счастливый',1),
  ('triste','грустный',2),
  ('cansado','уставший',3),
  ('enfadado','сердитый',4),
  ('contento','довольный',5),
  ('nervioso','нервный',6),
  ('aburrido','скучающий',7),
  ('enamorado','влюблённый',8),
  ('el miedo','страх',9),
  ('la alegría','радость',10),
  ('bueno','хороший',11),
  ('malo','плохой',12),
  ('importante','важный',13)
) AS v(word, tr, ord);

-- es · verbs
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','verbs',14,'Частые глаголы','▶️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('ser','быть',1),
  ('tener','иметь',2),
  ('hacer','делать',3),
  ('ir','идти / ехать',4),
  ('querer','хотеть',5),
  ('poder','мочь',6),
  ('hablar','говорить',7),
  ('comer','есть',8),
  ('beber','пить',9),
  ('ver','видеть',10),
  ('saber','знать',11),
  ('comprar','покупать',12),
  ('necesitar','нуждаться',13)
) AS v(word, tr, ord);

-- fr · house
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','house',9,'Дом и мебель','🛋️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la cuisine','кухня',1),
  ('le salon','гостиная',2),
  ('la salle de bain','ванная комната',3),
  ('le canapé','диван',4),
  ('l''armoire','шкаф',5),
  ('le frigo','холодильник',6),
  ('la lampe','лампа',7),
  ('le miroir','зеркало',8),
  ('le mur','стена',9),
  ('le sol','пол',10),
  ('le plafond','потолок',11),
  ('le jardin','сад',12),
  ('l''escalier','лестница',13)
) AS v(word, tr, ord);

-- fr · city
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','city',10,'Город и места','🏙️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la ville','город',1),
  ('le village','деревня',2),
  ('la banque','банк',3),
  ('la poste','почта',4),
  ('le musée','музей',5),
  ('le parc','парк',6),
  ('l''église','церковь',7),
  ('la bibliothèque','библиотека',8),
  ('l''école','школа',9),
  ('le cinéma','кинотеатр',10),
  ('le pont','мост',11),
  ('le supermarché','супермаркет',12),
  ('le bâtiment','здание',13)
) AS v(word, tr, ord);

-- fr · work
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','work',11,'Работа и профессии','💼',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la profession','профессия',1),
  ('le professeur','учитель',2),
  ('l''étudiant','студент',3),
  ('l''ingénieur','инженер',4),
  ('le cuisinier','повар',5),
  ('le chauffeur','водитель',6),
  ('le policier','полицейский',7),
  ('le vendeur','продавец',8),
  ('le patron','начальник',9),
  ('le bureau','офис',10),
  ('l''entreprise','компания',11),
  ('le salaire','зарплата',12),
  ('la réunion','совещание',13)
) AS v(word, tr, ord);

-- fr · hobbies
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','hobbies',12,'Хобби и досуг','⚽',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('le sport','спорт',1),
  ('la musique','музыка',2),
  ('le film','фильм',3),
  ('la lecture','чтение',4),
  ('le football','футбол',5),
  ('la natation','плавание',6),
  ('la danse','танцы',7),
  ('le voyage','путешествие',8),
  ('la photo','фото',9),
  ('le jeu','игра',10),
  ('la peinture','рисование',11),
  ('le temps libre','свободное время',12),
  ('la fête','праздник / вечеринка',13)
) AS v(word, tr, ord);

-- fr · feelings
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','feelings',13,'Чувства и качества','😊',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('heureux','счастливый',1),
  ('triste','грустный',2),
  ('fatigué','уставший',3),
  ('fâché','сердитый',4),
  ('content','довольный',5),
  ('nerveux','нервный',6),
  ('ennuyé','скучающий',7),
  ('amoureux','влюблённый',8),
  ('la peur','страх',9),
  ('la joie','радость',10),
  ('bon','хороший',11),
  ('mauvais','плохой',12),
  ('important','важный',13)
) AS v(word, tr, ord);

-- fr · verbs
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','verbs',14,'Частые глаголы','▶️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('être','быть',1),
  ('avoir','иметь',2),
  ('faire','делать',3),
  ('aller','идти / ехать',4),
  ('vouloir','хотеть',5),
  ('pouvoir','мочь',6),
  ('parler','говорить',7),
  ('manger','есть',8),
  ('boire','пить',9),
  ('voir','видеть',10),
  ('savoir','знать',11),
  ('acheter','покупать',12),
  ('avoir besoin','нуждаться',13)
) AS v(word, tr, ord);
