-- 143_de_a2.sql
-- Немецкий A2: travel (8) + быт (6) = 14 тем. Идемпотентно.

-- de · transport
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','transport',1,'Транспорт','✈️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('der Flughafen','аэропорт',1),
  ('das Ticket','билет',2),
  ('der Zug','поезд',3),
  ('der Bus','автобус',4),
  ('das Taxi','такси',5),
  ('das Flugzeug','самолёт',6),
  ('der Bahnhof','вокзал',7),
  ('das Gepäck','багаж',8),
  ('der Reisepass','паспорт',9),
  ('der Koffer','чемодан',10),
  ('die U-Bahn','метро',11),
  ('die Haltestelle','остановка',12),
  ('der Fahrplan','расписание',13)
) AS v(word, tr, ord);

-- de · hotel
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','hotel',2,'Гостиница','🏨',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('das Hotel','отель',1),
  ('das Zimmer','комната / номер',2),
  ('die Reservierung','бронь',3),
  ('der Schlüssel','ключ',4),
  ('das Frühstück','завтрак',5),
  ('die Rezeption','ресепшен',6),
  ('das Handtuch','полотенце',7),
  ('die Dusche','душ',8),
  ('die Toilette','туалет',9),
  ('der Aufzug','лифт',10),
  ('das Kissen','подушка',11),
  ('die Etage','этаж',12),
  ('die Klimaanlage','кондиционер',13)
) AS v(word, tr, ord);

-- de · restaurant
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','restaurant',3,'В ресторане','🍽️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('das Restaurant','ресторан',1),
  ('die Speisekarte','меню',2),
  ('die Rechnung','счёт',3),
  ('der Kellner','официант',4),
  ('das Trinkgeld','чаевые',5),
  ('das Getränk','напиток',6),
  ('der Teller','тарелка',7),
  ('die Gabel','вилка',8),
  ('das Messer','нож',9),
  ('der Löffel','ложка',10),
  ('die Serviette','салфетка',11),
  ('zum Mitnehmen','на вынос',12),
  ('ein Tisch für zwei','столик на двоих',13)
) AS v(word, tr, ord);

-- de · directions
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','directions',4,'Ориентирование','🧭',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('wo ist...?','где находится…?',1),
  ('links','налево',2),
  ('rechts','направо',3),
  ('geradeaus','прямо',4),
  ('nah','близко',5),
  ('weit','далеко',6),
  ('die Karte','карта',7),
  ('die Straße','улица',8),
  ('der Platz','площадь',9),
  ('das Zentrum','центр',10),
  ('hier','здесь',11),
  ('dort','там',12),
  ('die Ecke','угол',13)
) AS v(word, tr, ord);

-- de · shopping
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','shopping',5,'Покупки и деньги','🛍️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('wie viel kostet das?','сколько стоит?',1),
  ('das Geld','деньги',2),
  ('die Kreditkarte','банковская карта',3),
  ('das Bargeld','наличные',4),
  ('das Geschäft','магазин',5),
  ('der Markt','рынок',6),
  ('der Preis','цена',7),
  ('teuer','дорого',8),
  ('billig','дёшево',9),
  ('die Kasse','касса',10),
  ('der Kassenbon','чек',11),
  ('offen','открыто',12),
  ('geschlossen','закрыто',13)
) AS v(word, tr, ord);

-- de · emergency
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','emergency',6,'Помощь','🆘',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('Hilfe!','помогите!',1),
  ('der Arzt','врач',2),
  ('das Krankenhaus','больница',3),
  ('die Apotheke','аптека',4),
  ('die Polizei','полиция',5),
  ('der Krankenwagen','скорая',6),
  ('es tut weh','болит',7),
  ('ich bin krank','я болен',8),
  ('der Schmerz','боль',9),
  ('die Medizin','лекарство',10),
  ('Vorsicht!','осторожно!',11),
  ('ich habe mich verlaufen','я заблудился',12),
  ('der Notfall','чрезвычайная ситуация',13)
) AS v(word, tr, ord);

-- de · time
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','time',7,'Время и даты','⏰',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('heute','сегодня',1),
  ('morgen','завтра',2),
  ('gestern','вчера',3),
  ('jetzt','сейчас',4),
  ('die Stunde','час',5),
  ('die Minute','минута',6),
  ('die Woche','неделя',7),
  ('der Monat','месяц',8),
  ('der Montag','понедельник',9),
  ('der Dienstag','вторник',10),
  ('der Mittwoch','среда',11),
  ('das Wochenende','выходные',12),
  ('spät','поздно',13)
) AS v(word, tr, ord);

-- de · phrases
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','phrases',8,'Полезные фразы','💬',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('sprechen Sie Englisch?','вы говорите по-английски?',1),
  ('ich verstehe nicht','я не понимаю',2),
  ('können Sie das wiederholen?','можете повторить?',3),
  ('langsamer, bitte','медленнее, пожалуйста',4),
  ('ich spreche kein Deutsch','я не говорю по-немецки',5),
  ('was bedeutet das?','что это значит?',6),
  ('können Sie mir helfen?','можете мне помочь?',7),
  ('es tut mir leid','извините / сожалею',8),
  ('wo ist die Toilette?','где туалет?',9),
  ('wie heißt das?','как это называется?',10),
  ('ich suche...','я ищу…',11),
  ('können Sie das aufschreiben?','можете записать?',12),
  ('vielen Dank','большое спасибо',13)
) AS v(word, tr, ord);

-- de · house
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','house',9,'Дом и мебель','🛋️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('das Schlafzimmer','спальня',1),
  ('die Küche','кухня',2),
  ('das Wohnzimmer','гостиная',3),
  ('das Badezimmer','ванная комната',4),
  ('das Sofa','диван',5),
  ('der Schrank','шкаф',6),
  ('der Kühlschrank','холодильник',7),
  ('die Lampe','лампа',8),
  ('der Spiegel','зеркало',9),
  ('die Wand','стена',10),
  ('der Boden','пол',11),
  ('die Decke','потолок',12),
  ('der Garten','сад',13)
) AS v(word, tr, ord);

-- de · city
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','city',10,'Город и места','🏙️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('die Stadt','город',1),
  ('das Dorf','деревня',2),
  ('die Bank','банк',3),
  ('die Post','почта',4),
  ('das Museum','музей',5),
  ('der Park','парк',6),
  ('die Kirche','церковь',7),
  ('die Bibliothek','библиотека',8),
  ('die Schule','школа',9),
  ('das Kino','кинотеатр',10),
  ('die Brücke','мост',11),
  ('der Supermarkt','супермаркет',12),
  ('das Gebäude','здание',13)
) AS v(word, tr, ord);

-- de · work
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','work',11,'Работа и профессии','💼',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('der Beruf','профессия',1),
  ('der Lehrer','учитель',2),
  ('der Student','студент',3),
  ('der Ingenieur','инженер',4),
  ('der Koch','повар',5),
  ('der Fahrer','водитель',6),
  ('der Polizist','полицейский',7),
  ('der Verkäufer','продавец',8),
  ('der Chef','начальник',9),
  ('das Büro','офис',10),
  ('die Firma','компания',11),
  ('das Gehalt','зарплата',12),
  ('die Besprechung','совещание',13)
) AS v(word, tr, ord);

-- de · hobbies
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','hobbies',12,'Хобби и досуг','⚽',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('der Sport','спорт',1),
  ('die Musik','музыка',2),
  ('der Film','фильм',3),
  ('das Lesen','чтение',4),
  ('der Fußball','футбол',5),
  ('das Schwimmen','плавание',6),
  ('das Tanzen','танцы',7),
  ('die Reise','путешествие',8),
  ('das Foto','фото',9),
  ('das Spiel','игра',10),
  ('das Malen','рисование',11),
  ('die Freizeit','свободное время',12),
  ('die Party','вечеринка',13)
) AS v(word, tr, ord);

-- de · feelings
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','feelings',13,'Чувства и качества','😊',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('glücklich','счастливый',1),
  ('traurig','грустный',2),
  ('müde','уставший',3),
  ('wütend','сердитый',4),
  ('zufrieden','довольный',5),
  ('nervös','нервный',6),
  ('gelangweilt','скучающий',7),
  ('verliebt','влюблённый',8),
  ('die Angst','страх',9),
  ('die Freude','радость',10),
  ('gut','хороший',11),
  ('schlecht','плохой',12),
  ('wichtig','важный',13)
) AS v(word, tr, ord);

-- de · verbs
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('de','A2','verbs',14,'Частые глаголы','▶️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('sein','быть',1),
  ('haben','иметь',2),
  ('machen','делать',3),
  ('gehen','идти',4),
  ('wollen','хотеть',5),
  ('können','мочь',6),
  ('sprechen','говорить',7),
  ('essen','есть',8),
  ('trinken','пить',9),
  ('sehen','видеть',10),
  ('wissen','знать',11),
  ('kaufen','покупать',12),
  ('brauchen','нуждаться',13)
) AS v(word, tr, ord);
