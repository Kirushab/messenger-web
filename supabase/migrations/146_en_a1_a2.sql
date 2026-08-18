-- 146_en_a1_a2.sql
-- Английский: A1-доп (Цвета, Одежда, Животные) + A2-доп (Гостиница..Глаголы). Идемпотентно.
-- Обойдены существующие EN-слова (airport/hotel/map/doctor/hospital/medicine/computer/email/city/house...).

-- en · A1 · colors
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','A1','colors',6,'Цвета','🎨',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('color','цвет',1),
  ('red','красный',2),
  ('blue','синий',3),
  ('green','зелёный',4),
  ('yellow','жёлтый',5),
  ('black','чёрный',6),
  ('white','белый',7),
  ('orange','оранжевый',8),
  ('pink','розовый',9),
  ('gray','серый',10),
  ('brown','коричневый',11),
  ('purple','фиолетовый',12)
) AS v(word, tr, ord);

-- en · A1 · clothes
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','A1','clothes',7,'Одежда','👕',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('clothes','одежда',1),
  ('t-shirt','футболка',2),
  ('shirt','рубашка',3),
  ('trousers','брюки',4),
  ('dress','платье',5),
  ('skirt','юбка',6),
  ('shoes','обувь',7),
  ('jacket','куртка',8),
  ('coat','пальто',9),
  ('hat','шляпа',10),
  ('socks','носки',11),
  ('gloves','перчатки',12)
) AS v(word, tr, ord);

-- en · A1 · animals
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','A1','animals',8,'Животные','🐶',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('animal','животное',1),
  ('dog','собака',2),
  ('cat','кошка',3),
  ('horse','лошадь',4),
  ('bird','птица',5),
  ('mouse','мышь',6),
  ('cow','корова',7),
  ('pig','свинья',8),
  ('sheep','овца',9),
  ('rabbit','кролик',10),
  ('bear','медведь',11),
  ('lion','лев',12)
) AS v(word, tr, ord);

-- en · A2 · hotel
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','A2','hotel',6,'Гостиница','🏨',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('room','номер / комната',1),
  ('reservation','бронь',2),
  ('key','ключ',3),
  ('breakfast','завтрак',4),
  ('reception','ресепшен',5),
  ('towel','полотенце',6),
  ('shower','душ',7),
  ('toilet','туалет',8),
  ('lift','лифт',9),
  ('pillow','подушка',10),
  ('floor','этаж',11),
  ('blanket','одеяло',12),
  ('air conditioning','кондиционер',13)
) AS v(word, tr, ord);

-- en · A2 · restaurant
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','A2','restaurant',7,'В ресторане','🍽️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('restaurant','ресторан',1),
  ('menu','меню',2),
  ('bill','счёт',3),
  ('waiter','официант',4),
  ('tip','чаевые',5),
  ('drink','напиток',6),
  ('plate','тарелка',7),
  ('fork','вилка',8),
  ('knife','нож',9),
  ('spoon','ложка',10),
  ('napkin','салфетка',11),
  ('takeaway','на вынос',12),
  ('a table for two','столик на двоих',13)
) AS v(word, tr, ord);

-- en · A2 · directions
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','A2','directions',8,'Ориентирование','🧭',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('where is...?','где находится…?',1),
  ('left','налево',2),
  ('right','направо',3),
  ('straight ahead','прямо',4),
  ('near','близко',5),
  ('far','далеко',6),
  ('street','улица',7),
  ('square','площадь',8),
  ('centre','центр',9),
  ('here','здесь',10),
  ('there','там',11),
  ('corner','угол',12),
  ('crossroads','перекрёсток',13)
) AS v(word, tr, ord);

-- en · A2 · shopping
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','A2','shopping',9,'Покупки и деньги','🛍️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('how much is it?','сколько стоит?',1),
  ('money','деньги',2),
  ('card','карта (банковская)',3),
  ('cash','наличные',4),
  ('shop','магазин',5),
  ('market','рынок',6),
  ('price','цена',7),
  ('expensive','дорого',8),
  ('cheap','дёшево',9),
  ('checkout','касса',10),
  ('receipt','чек',11),
  ('open','открыто',12),
  ('closed','закрыто',13)
) AS v(word, tr, ord);

-- en · A2 · emergency
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','A2','emergency',10,'Помощь','🆘',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('help!','помогите!',1),
  ('police','полиция',2),
  ('ambulance','скорая',3),
  ('pharmacy','аптека',4),
  ('it hurts','болит',5),
  ('I''m sick','я болен',6),
  ('pain','боль',7),
  ('emergency','чрезвычайная ситуация',8),
  ('careful!','осторожно!',9),
  ('I''m lost','я заблудился',10),
  ('call the police','вызовите полицию',11),
  ('fire!','пожар!',12),
  ('accident','авария / несчастный случай',13)
) AS v(word, tr, ord);

-- en · A2 · phrases
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','A2','phrases',11,'Полезные фразы','💬',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('do you speak English?','вы говорите по-английски?',1),
  ('I don''t understand','я не понимаю',2),
  ('can you repeat that?','можете повторить?',3),
  ('more slowly, please','медленнее, пожалуйста',4),
  ('I speak a little English','я немного говорю по-английски',5),
  ('what does it mean?','что это значит?',6),
  ('can you help me?','можете мне помочь?',7),
  ('I''m sorry','извините',8),
  ('where is the toilet?','где туалет?',9),
  ('what is this called?','как это называется?',10),
  ('I''m looking for...','я ищу…',11),
  ('can you write it down?','можете записать?',12),
  ('thank you very much','большое спасибо',13)
) AS v(word, tr, ord);

-- en · A2 · city
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','A2','city',12,'Город и места','🏙️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('town','город / городок',1),
  ('village','деревня',2),
  ('bank','банк',3),
  ('post office','почта',4),
  ('museum','музей',5),
  ('park','парк',6),
  ('church','церковь',7),
  ('library','библиотека',8),
  ('school','школа',9),
  ('cinema','кинотеатр',10),
  ('bridge','мост',11),
  ('supermarket','супермаркет',12),
  ('building','здание',13)
) AS v(word, tr, ord);

-- en · A2 · hobbies
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','A2','hobbies',13,'Хобби и досуг','⚽',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('sport','спорт',1),
  ('music','музыка',2),
  ('film','фильм',3),
  ('reading','чтение',4),
  ('football','футбол',5),
  ('swimming','плавание',6),
  ('dancing','танцы',7),
  ('hobby','хобби',8),
  ('photo','фото',9),
  ('game','игра',10),
  ('painting','рисование',11),
  ('free time','свободное время',12),
  ('party','вечеринка',13)
) AS v(word, tr, ord);

-- en · A2 · verbs
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('en','A2','verbs',14,'Частые глаголы','▶️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('to be','быть',1),
  ('to have','иметь',2),
  ('to do','делать',3),
  ('to go','идти / ехать',4),
  ('to want','хотеть',5),
  ('can','мочь',6),
  ('to speak','говорить',7),
  ('to eat','есть',8),
  ('to drink','пить',9),
  ('to see','видеть',10),
  ('to know','знать',11),
  ('to buy','покупать',12),
  ('to need','нуждаться',13)
) AS v(word, tr, ord);
