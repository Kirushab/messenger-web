-- 141_es_fr_b1.sql
-- B1-общение для es/fr: Мнение, Природа, Технологии, Здоровье, Образование, Характер. Идемпотентно.

-- es · opinions
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','B1','opinions',1,'Мнение и беседа','💭',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la opinión','мнение',1),
  ('creer','считать / верить',2),
  ('pensar','думать',3),
  ('estar de acuerdo','соглашаться',4),
  ('quizás','возможно',5),
  ('porque','потому что',6),
  ('pero','но',7),
  ('también','тоже',8),
  ('sin embargo','однако',9),
  ('por ejemplo','например',10),
  ('en mi opinión','по-моему',11),
  ('la razón','причина',12),
  ('la idea','идея',13)
) AS v(word, tr, ord);

-- es · nature
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','B1','nature',2,'Природа','🌳',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la naturaleza','природа',1),
  ('el árbol','дерево',2),
  ('la flor','цветок',3),
  ('el río','река',4),
  ('el mar','море',5),
  ('la montaña','гора',6),
  ('el bosque','лес',7),
  ('el cielo','небо',8),
  ('la tierra','земля',9),
  ('la playa','пляж',10),
  ('el lago','озеро',11),
  ('la hoja','лист',12),
  ('la piedra','камень',13)
) AS v(word, tr, ord);

-- es · technology
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','B1','technology',3,'Технологии и интернет','💻',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la tecnología','технология',1),
  ('el ordenador','компьютер',2),
  ('internet','интернет',3),
  ('el correo electrónico','электронная почта',4),
  ('la contraseña','пароль',5),
  ('la pantalla','экран',6),
  ('el archivo','файл',7),
  ('la aplicación','приложение',8),
  ('la red','сеть',9),
  ('descargar','скачивать',10),
  ('el mensaje','сообщение',11),
  ('la cámara','камера',12),
  ('el usuario','пользователь',13)
) AS v(word, tr, ord);

-- es · health
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','B1','health',4,'Здоровье','🏥',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la salud','здоровье',1),
  ('la enfermedad','болезнь',2),
  ('la fiebre','температура / жар',3),
  ('la tos','кашель',4),
  ('el resfriado','простуда',5),
  ('la receta','рецепт',6),
  ('la cita','приём (запись)',7),
  ('el síntoma','симптом',8),
  ('sano','здоровый',9),
  ('la herida','рана',10),
  ('la pastilla','таблетка',11),
  ('el dentista','стоматолог',12),
  ('descansar','отдыхать',13)
) AS v(word, tr, ord);

-- es · education
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','B1','education',5,'Образование','🎓',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la educación','образование',1),
  ('la universidad','университет',2),
  ('el examen','экзамен',3),
  ('la clase','урок / класс',4),
  ('el alumno','ученик',5),
  ('el deber','домашнее задание',6),
  ('aprender','учиться / изучать',7),
  ('enseñar','преподавать',8),
  ('la nota','оценка',9),
  ('el idioma','язык (иностранный)',10),
  ('la pregunta','вопрос',11),
  ('la respuesta','ответ',12),
  ('estudiar','учиться',13)
) AS v(word, tr, ord);

-- es · character
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','B1','character',6,'Характер и эмоции','🧠',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('el carácter','характер',1),
  ('amable','добрый / любезный',2),
  ('simpático','приятный',3),
  ('inteligente','умный',4),
  ('tímido','застенчивый',5),
  ('trabajador','трудолюбивый',6),
  ('honesto','честный',7),
  ('generoso','щедрый',8),
  ('valiente','смелый',9),
  ('tranquilo','спокойный',10),
  ('divertido','весёлый',11),
  ('serio','серьёзный',12),
  ('perezoso','ленивый',13)
) AS v(word, tr, ord);

-- fr · opinions
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','B1','opinions',1,'Мнение и беседа','💭',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('l''opinion','мнение',1),
  ('croire','считать / верить',2),
  ('penser','думать',3),
  ('être d''accord','соглашаться',4),
  ('peut-être','возможно',5),
  ('parce que','потому что',6),
  ('mais','но',7),
  ('aussi','тоже',8),
  ('cependant','однако',9),
  ('par exemple','например',10),
  ('à mon avis','по-моему',11),
  ('la raison','причина',12),
  ('l''idée','идея',13)
) AS v(word, tr, ord);

-- fr · nature
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','B1','nature',2,'Природа','🌳',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la nature','природа',1),
  ('l''arbre','дерево',2),
  ('la fleur','цветок',3),
  ('la rivière','река',4),
  ('la mer','море',5),
  ('la montagne','гора',6),
  ('la forêt','лес',7),
  ('le ciel','небо',8),
  ('la terre','земля',9),
  ('la plage','пляж',10),
  ('le lac','озеро',11),
  ('la feuille','лист',12),
  ('la pierre','камень',13)
) AS v(word, tr, ord);

-- fr · technology
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','B1','technology',3,'Технологии и интернет','💻',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la technologie','технология',1),
  ('l''ordinateur','компьютер',2),
  ('internet','интернет',3),
  ('l''e-mail','электронная почта',4),
  ('le mot de passe','пароль',5),
  ('l''écran','экран',6),
  ('le fichier','файл',7),
  ('l''application','приложение',8),
  ('le réseau','сеть',9),
  ('télécharger','скачивать',10),
  ('le message','сообщение',11),
  ('la caméra','камера',12),
  ('l''utilisateur','пользователь',13)
) AS v(word, tr, ord);

-- fr · health
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','B1','health',4,'Здоровье','🏥',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('la santé','здоровье',1),
  ('la maladie','болезнь',2),
  ('la fièvre','температура / жар',3),
  ('la toux','кашель',4),
  ('le rhume','простуда',5),
  ('l''ordonnance','рецепт',6),
  ('le rendez-vous','приём (запись)',7),
  ('le symptôme','симптом',8),
  ('en bonne santé','здоровый',9),
  ('la blessure','рана',10),
  ('le comprimé','таблетка',11),
  ('le dentiste','стоматолог',12),
  ('se reposer','отдыхать',13)
) AS v(word, tr, ord);

-- fr · education
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','B1','education',5,'Образование','🎓',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('l''éducation','образование',1),
  ('l''université','университет',2),
  ('l''examen','экзамен',3),
  ('la classe','класс / урок',4),
  ('l''élève','ученик',5),
  ('les devoirs','домашнее задание',6),
  ('apprendre','учиться / изучать',7),
  ('enseigner','преподавать',8),
  ('la note','оценка',9),
  ('la langue','язык (иностранный)',10),
  ('la question','вопрос',11),
  ('la réponse','ответ',12),
  ('étudier','учиться',13)
) AS v(word, tr, ord);

-- fr · character
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','B1','character',6,'Характер и эмоции','🧠',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('le caractère','характер',1),
  ('gentil','добрый / любезный',2),
  ('sympathique','приятный',3),
  ('intelligent','умный',4),
  ('timide','застенчивый',5),
  ('travailleur','трудолюбивый',6),
  ('honnête','честный',7),
  ('généreux','щедрый',8),
  ('courageux','смелый',9),
  ('calme','спокойный',10),
  ('amusant','весёлый',11),
  ('sérieux','серьёзный',12),
  ('paresseux','ленивый',13)
) AS v(word, tr, ord);
