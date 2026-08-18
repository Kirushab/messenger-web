-- 138_es_fr_travel_a2.sql
-- Travel-набор A2 (8 тем) для испанского и французского. Идемпотентно (как 137).
-- Требует, чтобы 137 уже сняла CHECK на язык (es/fr разрешены).

-- es · transport
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','transport',1,'Транспорт','✈️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('el aeropuerto','аэропорт',1),
  ('el billete','билет',2),
  ('el tren','поезд',3),
  ('el autobús','автобус',4),
  ('el taxi','такси',5),
  ('el avión','самолёт',6),
  ('la estación','вокзал',7),
  ('el equipaje','багаж',8),
  ('el pasaporte','паспорт',9),
  ('la maleta','чемодан',10),
  ('el metro','метро',11),
  ('la parada','остановка',12),
  ('el horario','расписание',13)
) AS v(word, tr, ord);

-- es · hotel
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','hotel',2,'Гостиница','🏨',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('el hotel','отель',1),
  ('la habitación','номер',2),
  ('la reserva','бронь',3),
  ('la llave','ключ',4),
  ('el desayuno','завтрак',5),
  ('la recepción','ресепшен',6),
  ('la toalla','полотенце',7),
  ('la ducha','душ',8),
  ('el baño','туалет / ванная',9),
  ('el ascensor','лифт',10),
  ('la almohada','подушка',11),
  ('la planta','этаж',12),
  ('el aire acondicionado','кондиционер',13)
) AS v(word, tr, ord);

-- es · restaurant
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','restaurant',3,'В ресторане','🍽️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('el restaurante','ресторан',1),
  ('el menú','меню',2),
  ('la cuenta','счёт',3),
  ('el camarero','официант',4),
  ('la propina','чаевые',5),
  ('la bebida','напиток',6),
  ('el plato','блюдо',7),
  ('el tenedor','вилка',8),
  ('el cuchillo','нож',9),
  ('la cuchara','ложка',10),
  ('la servilleta','салфетка',11),
  ('para llevar','на вынос',12),
  ('una mesa para dos','столик на двоих',13)
) AS v(word, tr, ord);

-- es · directions
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','directions',4,'Ориентирование','🧭',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('¿dónde está...?','где находится…?',1),
  ('la izquierda','лево',2),
  ('la derecha','право',3),
  ('recto','прямо',4),
  ('cerca','близко',5),
  ('lejos','далеко',6),
  ('el mapa','карта',7),
  ('la calle','улица',8),
  ('la plaza','площадь',9),
  ('el centro','центр',10),
  ('aquí','здесь',11),
  ('allí','там',12),
  ('la esquina','угол',13)
) AS v(word, tr, ord);

-- es · shopping
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','shopping',5,'Покупки и деньги','🛍️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('¿cuánto cuesta?','сколько стоит?',1),
  ('el dinero','деньги',2),
  ('la tarjeta','карта (банковская)',3),
  ('el efectivo','наличные',4),
  ('la tienda','магазин',5),
  ('el mercado','рынок',6),
  ('el precio','цена',7),
  ('caro','дорого',8),
  ('barato','дёшево',9),
  ('la caja','касса',10),
  ('el recibo','чек',11),
  ('abierto','открыто',12),
  ('cerrado','закрыто',13)
) AS v(word, tr, ord);

-- es · emergency
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','emergency',6,'Помощь','🆘',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('¡ayuda!','помогите!',1),
  ('el médico','врач',2),
  ('el hospital','больница',3),
  ('la farmacia','аптека',4),
  ('la policía','полиция',5),
  ('la ambulancia','скорая',6),
  ('me duele','у меня болит',7),
  ('estoy enfermo','я болен',8),
  ('el dolor','боль',9),
  ('la medicina','лекарство',10),
  ('¡cuidado!','осторожно!',11),
  ('estoy perdido','я заблудился',12),
  ('la emergencia','чрезвычайная ситуация',13)
) AS v(word, tr, ord);

-- es · time
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','time',7,'Время и даты','⏰',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('hoy','сегодня',1),
  ('mañana','завтра',2),
  ('ayer','вчера',3),
  ('ahora','сейчас',4),
  ('la hora','час / время',5),
  ('el minuto','минута',6),
  ('la semana','неделя',7),
  ('el mes','месяц',8),
  ('el lunes','понедельник',9),
  ('el martes','вторник',10),
  ('el miércoles','среда',11),
  ('el fin de semana','выходные',12),
  ('tarde','поздно',13)
) AS v(word, tr, ord);

-- es · phrases
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('es','A2','phrases',8,'Полезные фразы','💬',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('¿habla inglés?','вы говорите по-английски?',1),
  ('no entiendo','я не понимаю',2),
  ('¿puede repetir?','можете повторить?',3),
  ('más despacio, por favor','медленнее, пожалуйста',4),
  ('no hablo español','я не говорю по-испански',5),
  ('¿qué significa?','что это значит?',6),
  ('¿me ayuda?','поможете мне?',7),
  ('lo siento','извините / сожалею',8),
  ('¿dónde está el baño?','где туалет?',9),
  ('¿cómo se llama esto?','как это называется?',10),
  ('estoy buscando...','я ищу…',11),
  ('¿puede escribirlo?','можете это записать?',12),
  ('muchas gracias','большое спасибо',13)
) AS v(word, tr, ord);

-- fr · transport
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','transport',1,'Транспорт','✈️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('l''aéroport','аэропорт',1),
  ('le billet','билет',2),
  ('le train','поезд',3),
  ('le bus','автобус',4),
  ('le taxi','такси',5),
  ('l''avion','самолёт',6),
  ('la gare','вокзал',7),
  ('les bagages','багаж',8),
  ('le passeport','паспорт',9),
  ('la valise','чемодан',10),
  ('le métro','метро',11),
  ('l''arrêt','остановка',12),
  ('l''horaire','расписание',13)
) AS v(word, tr, ord);

-- fr · hotel
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','hotel',2,'Гостиница','🏨',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('l''hôtel','отель',1),
  ('la chambre','номер / комната',2),
  ('la réservation','бронь',3),
  ('la clé','ключ',4),
  ('le petit déjeuner','завтрак',5),
  ('la réception','ресепшен',6),
  ('la serviette','полотенце',7),
  ('la douche','душ',8),
  ('les toilettes','туалет',9),
  ('l''ascenseur','лифт',10),
  ('l''oreiller','подушка',11),
  ('l''étage','этаж',12),
  ('la climatisation','кондиционер',13)
) AS v(word, tr, ord);

-- fr · restaurant
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','restaurant',3,'В ресторане','🍽️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('le restaurant','ресторан',1),
  ('le menu','меню',2),
  ('l''addition','счёт',3),
  ('le serveur','официант',4),
  ('le pourboire','чаевые',5),
  ('la boisson','напиток',6),
  ('le plat','блюдо',7),
  ('la fourchette','вилка',8),
  ('le couteau','нож',9),
  ('la cuillère','ложка',10),
  ('le verre','стакан',11),
  ('à emporter','на вынос',12),
  ('une table pour deux','столик на двоих',13)
) AS v(word, tr, ord);

-- fr · directions
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','directions',4,'Ориентирование','🧭',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('où est... ?','где находится…?',1),
  ('la gauche','лево',2),
  ('la droite','право',3),
  ('tout droit','прямо',4),
  ('près','близко',5),
  ('loin','далеко',6),
  ('la carte','карта',7),
  ('la rue','улица',8),
  ('la place','площадь',9),
  ('le centre','центр',10),
  ('ici','здесь',11),
  ('là-bas','там',12),
  ('le coin','угол',13)
) AS v(word, tr, ord);

-- fr · shopping
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','shopping',5,'Покупки и деньги','🛍️',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('combien ça coûte ?','сколько стоит?',1),
  ('l''argent','деньги',2),
  ('la carte bancaire','банковская карта',3),
  ('les espèces','наличные',4),
  ('le magasin','магазин',5),
  ('le marché','рынок',6),
  ('le prix','цена',7),
  ('cher','дорого',8),
  ('bon marché','дёшево',9),
  ('la caisse','касса',10),
  ('le reçu','чек',11),
  ('ouvert','открыто',12),
  ('fermé','закрыто',13)
) AS v(word, tr, ord);

-- fr · emergency
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','emergency',6,'Помощь','🆘',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('au secours !','на помощь!',1),
  ('le médecin','врач',2),
  ('l''hôpital','больница',3),
  ('la pharmacie','аптека',4),
  ('la police','полиция',5),
  ('l''ambulance','скорая',6),
  ('j''ai mal','у меня болит',7),
  ('je suis malade','я болен',8),
  ('la douleur','боль',9),
  ('le médicament','лекарство',10),
  ('attention !','осторожно!',11),
  ('je suis perdu','я заблудился',12),
  ('l''urgence','чрезвычайная ситуация',13)
) AS v(word, tr, ord);

-- fr · time
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','time',7,'Время и даты','⏰',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('aujourd''hui','сегодня',1),
  ('demain','завтра',2),
  ('hier','вчера',3),
  ('maintenant','сейчас',4),
  ('l''heure','час / время',5),
  ('la minute','минута',6),
  ('la semaine','неделя',7),
  ('le mois','месяц',8),
  ('lundi','понедельник',9),
  ('mardi','вторник',10),
  ('mercredi','среда',11),
  ('le week-end','выходные',12),
  ('tard','поздно',13)
) AS v(word, tr, ord);

-- fr · phrases
WITH c AS (
  INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru)
  VALUES ('fr','A2','phrases',8,'Полезные фразы','💬',NULL)
  ON CONFLICT (language, level, theme) DO UPDATE SET order_index=EXCLUDED.order_index, title_ru=EXCLUDED.title_ru, icon=EXCLUDED.icon
  RETURNING id
), del AS ( DELETE FROM public.language_words WHERE course_id IN (SELECT id FROM c) )
INSERT INTO public.language_words (course_id, word, translation_ru, order_index)
SELECT (SELECT id FROM c), v.word, v.tr, v.ord FROM (VALUES
  ('parlez-vous anglais ?','вы говорите по-английски?',1),
  ('je ne comprends pas','я не понимаю',2),
  ('pouvez-vous répéter ?','можете повторить?',3),
  ('plus lentement, s''il vous plaît','медленнее, пожалуйста',4),
  ('je ne parle pas français','я не говорю по-французски',5),
  ('qu''est-ce que ça veut dire ?','что это значит?',6),
  ('pouvez-vous m''aider ?','можете мне помочь?',7),
  ('je suis désolé','извините / сожалею',8),
  ('où sont les toilettes ?','где туалет?',9),
  ('comment ça s''appelle ?','как это называется?',10),
  ('je cherche...','я ищу…',11),
  ('pouvez-vous l''écrire ?','можете это записать?',12),
  ('merci beaucoup','большое спасибо',13)
) AS v(word, tr, ord);
