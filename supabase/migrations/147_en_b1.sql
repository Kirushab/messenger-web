-- 147_en_b1.sql
-- Английский B1: Мнение, Природа, Технологии, Здоровье, Образование, Характер. Идемпотентно.
-- Обойдены computer/email/doctor/hospital/medicine/healthy.

-- en · B1 · opinions
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','B1','opinions',1,'Мнение и беседа','💭',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('opinion','мнение',1),
  ('to think','думать',2),
  ('to believe','считать / верить',3),
  ('to agree','соглашаться',4),
  ('maybe','возможно',5),
  ('because','потому что',6),
  ('but','но',7),
  ('also','тоже',8),
  ('however','однако',9),
  ('for example','например',10),
  ('in my opinion','по-моему',11),
  ('reason','причина',12),
  ('idea','идея',13)
) AS v(word, tr, ord);

-- en · B1 · nature
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','B1','nature',2,'Природа','🌳',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('nature','природа',1),
  ('tree','дерево',2),
  ('flower','цветок',3),
  ('river','река',4),
  ('sea','море',5),
  ('mountain','гора',6),
  ('forest','лес',7),
  ('sky','небо',8),
  ('earth','земля',9),
  ('beach','пляж',10),
  ('lake','озеро',11),
  ('leaf','лист',12),
  ('stone','камень',13)
) AS v(word, tr, ord);

-- en · B1 · technology
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','B1','technology',3,'Технологии и интернет','💻',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('technology','технология',1),
  ('internet','интернет',2),
  ('password','пароль',3),
  ('screen','экран',4),
  ('file','файл',5),
  ('app','приложение',6),
  ('network','сеть',7),
  ('to download','скачивать',8),
  ('message','сообщение',9),
  ('camera','камера',10),
  ('user','пользователь',11),
  ('website','сайт',12),
  ('keyboard','клавиатура',13)
) AS v(word, tr, ord);

-- en · B1 · health
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','B1','health',4,'Здоровье','🏥',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('health','здоровье',1),
  ('illness','болезнь',2),
  ('fever','температура / жар',3),
  ('cough','кашель',4),
  ('prescription','рецепт',5),
  ('appointment','приём (запись)',6),
  ('symptom','симптом',7),
  ('wound','рана',8),
  ('pill','таблетка',9),
  ('dentist','стоматолог',10),
  ('to rest','отдыхать',11),
  ('nurse','медсестра',12),
  ('blood','кровь',13)
) AS v(word, tr, ord);

-- en · B1 · education
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','B1','education',5,'Образование','🎓',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('education','образование',1),
  ('university','университет',2),
  ('exam','экзамен',3),
  ('lesson','урок',4),
  ('pupil','ученик',5),
  ('homework','домашнее задание',6),
  ('to learn','учиться / изучать',7),
  ('to teach','преподавать',8),
  ('mark','оценка',9),
  ('language','язык',10),
  ('question','вопрос',11),
  ('answer','ответ',12),
  ('to study','учиться',13)
) AS v(word, tr, ord);

-- en · B1 · character
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','B1','character',6,'Характер и эмоции','🧠',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('character','характер',1),
  ('kind','добрый',2),
  ('friendly','приветливый',3),
  ('intelligent','умный',4),
  ('shy','застенчивый',5),
  ('hardworking','трудолюбивый',6),
  ('honest','честный',7),
  ('generous','щедрый',8),
  ('brave','смелый',9),
  ('calm','спокойный',10),
  ('funny','весёлый',11),
  ('serious','серьёзный',12),
  ('lazy','ленивый',13)
) AS v(word, tr, ord);
