-- 145_it_travel.sql
-- Итальянский A2: travel-практика (Гостиница, Ресторан, Ориентирование, Помощь, Фразы). Идемпотентно.
-- Слова medico/ospedale/farmacia/hotel уже есть у it — здесь не дублируются.

-- it · hotel
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('it','A2','hotel',11,'Гостиница','🏨',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('l''albergo','отель / гостиница',1),
  ('la camera','номер / комната',2),
  ('la prenotazione','бронь',3),
  ('la chiave','ключ',4),
  ('la colazione','завтрак',5),
  ('la reception','ресепшен',6),
  ('l''asciugamano','полотенце',7),
  ('la doccia','душ',8),
  ('il bagno','туалет / ванная',9),
  ('l''ascensore','лифт',10),
  ('il cuscino','подушка',11),
  ('il piano','этаж',12),
  ('l''aria condizionata','кондиционер',13)
) AS v(word, tr, ord);

-- it · ristorante
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('it','A2','ristorante',12,'В ресторане','🍽️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('il ristorante','ресторан',1),
  ('il menù','меню',2),
  ('il conto','счёт',3),
  ('il cameriere','официант',4),
  ('la mancia','чаевые',5),
  ('la bevanda','напиток',6),
  ('il piatto','блюдо / тарелка',7),
  ('la forchetta','вилка',8),
  ('il coltello','нож',9),
  ('il cucchiaio','ложка',10),
  ('il tovagliolo','салфетка',11),
  ('da portare via','на вынос',12),
  ('un tavolo per due','столик на двоих',13)
) AS v(word, tr, ord);

-- it · indicazioni
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('it','A2','indicazioni',13,'Ориентирование','🧭',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('dov''è...?','где находится…?',1),
  ('a sinistra','налево',2),
  ('a destra','направо',3),
  ('dritto','прямо',4),
  ('vicino','близко',5),
  ('lontano','далеко',6),
  ('la mappa','карта',7),
  ('la strada','улица / дорога',8),
  ('la piazza','площадь',9),
  ('il centro','центр',10),
  ('qui','здесь',11),
  ('lì','там',12),
  ('l''angolo','угол',13)
) AS v(word, tr, ord);

-- it · emergenza
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('it','A2','emergenza',14,'Помощь','🆘',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('aiuto!','помогите!',1),
  ('la polizia','полиция',2),
  ('l''ambulanza','скорая',3),
  ('il pronto soccorso','скорая помощь / приёмный покой',4),
  ('mi fa male','у меня болит',5),
  ('sono malato','я болен',6),
  ('il dolore','боль',7),
  ('la medicina','лекарство',8),
  ('attenzione!','осторожно!',9),
  ('mi sono perso','я заблудился',10),
  ('l''emergenza','чрезвычайная ситуация',11),
  ('chiami la polizia!','вызовите полицию!',12),
  ('ho bisogno di aiuto','мне нужна помощь',13)
) AS v(word, tr, ord);

-- it · frasi
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('it','A2','frasi',15,'Полезные фразы','💬',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('parla inglese?','вы говорите по-английски?',1),
  ('non capisco','я не понимаю',2),
  ('può ripetere?','можете повторить?',3),
  ('più lentamente, per favore','медленнее, пожалуйста',4),
  ('non parlo italiano','я не говорю по-итальянски',5),
  ('cosa significa?','что это значит?',6),
  ('può aiutarmi?','можете мне помочь?',7),
  ('mi dispiace','извините / сожалею',8),
  ('dov''è il bagno?','где туалет?',9),
  ('come si chiama questo?','как это называется?',10),
  ('sto cercando...','я ищу…',11),
  ('può scriverlo?','можете записать?',12),
  ('grazie mille','большое спасибо',13)
) AS v(word, tr, ord);
