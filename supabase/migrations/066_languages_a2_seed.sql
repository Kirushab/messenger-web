-- ============================================================
-- 066_languages_a2_seed.sql
-- Уровень A2: 5 новых тем × 2 языка × 10 слов = 100 слов.
-- Темы: путешествия, работа, время/погода, чувства, тело/здоровье.
-- ============================================================

-- ============ ТЕМЫ A2 ============

INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru) VALUES
  ('en', 'A2', 'travel',   1, 'Путешествия',  '✈️',  'Аэропорт, билет, отель'),
  ('en', 'A2', 'work',     2, 'Работа',       '💼',  'Офис, встреча, проект'),
  ('en', 'A2', 'weather',  3, 'Время и погода','🌦️','Утро, дождь, завтра'),
  ('en', 'A2', 'feelings', 4, 'Чувства',      '🥰',  'Радость, грусть, любовь'),
  ('en', 'A2', 'body',     5, 'Тело и здоровье','🩺','Голова, рука, врач'),
  ('it', 'A2', 'travel',   1, 'Путешествия',  '✈️',  'Аэропорт, билет, отель'),
  ('it', 'A2', 'work',     2, 'Работа',       '💼',  'Офис, встреча, проект'),
  ('it', 'A2', 'weather',  3, 'Время и погода','🌦️','Утро, дождь, завтра'),
  ('it', 'A2', 'feelings', 4, 'Чувства',      '🥰',  'Радость, грусть, любовь'),
  ('it', 'A2', 'body',     5, 'Тело и здоровье','🩺','Голова, рука, врач')
ON CONFLICT (language, level, theme) DO UPDATE SET
  title_ru = EXCLUDED.title_ru,
  icon     = EXCLUDED.icon,
  description_ru = EXCLUDED.description_ru,
  order_index    = EXCLUDED.order_index;

-- Пересоздаём слова A2 (на случай повторного запуска)
DELETE FROM public.language_words
WHERE course_id IN (SELECT id FROM public.language_courses WHERE level = 'A2');

-- ===== EN A2 =====

-- travel
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('airport',  'аэропорт',  'I''m at the airport.',     'Я в аэропорту.',         1),
    ('ticket',   'билет',     'I have a ticket.',         'У меня есть билет.',     2),
    ('hotel',    'отель',     'A nice hotel.',            'Хороший отель.',          3),
    ('passport', 'паспорт',   'Show me your passport.',   'Покажи свой паспорт.',   4),
    ('train',    'поезд',     'The train is fast.',       'Поезд быстрый.',         5),
    ('map',      'карта',     'Where is the map?',        'Где карта?',             6),
    ('bag',      'сумка',     'My bag is heavy.',         'Моя сумка тяжёлая.',     7),
    ('room',     'комната',   'A clean room.',            'Чистая комната.',        8),
    ('street',   'улица',     'A long street.',           'Длинная улица.',         9),
    ('bus',      'автобус',   'Where is the bus?',        'Где автобус?',          10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A2' AND c.theme='travel';

-- work
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('office',    'офис',       'I work at the office.',     'Я работаю в офисе.',          1),
    ('meeting',   'встреча',    'The meeting is at 3.',      'Встреча в три.',              2),
    ('email',     'имейл',      'Send me an email.',         'Пришли мне имейл.',           3),
    ('boss',      'начальник',  'My boss is nice.',          'Мой начальник хороший.',      4),
    ('computer',  'компьютер',  'A new computer.',           'Новый компьютер.',            5),
    ('project',   'проект',     'A big project.',            'Большой проект.',             6),
    ('deadline',  'срок',       'The deadline is Friday.',   'Срок — пятница.',             7),
    ('salary',    'зарплата',   'A good salary.',            'Хорошая зарплата.',           8),
    ('colleague', 'коллега',    'My colleague is busy.',     'Мой коллега занят.',          9),
    ('task',      'задача',     'A difficult task.',         'Сложная задача.',            10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A2' AND c.theme='work';

-- weather (time + weather)
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('morning',  'утро',     'Good morning!',           'Доброе утро!',           1),
    ('evening',  'вечер',    'In the evening.',         'Вечером.',               2),
    ('today',    'сегодня',  'I work today.',           'Я работаю сегодня.',     3),
    ('tomorrow', 'завтра',   'See you tomorrow.',       'До завтра.',             4),
    ('year',     'год',      'This year is warm.',      'Этот год тёплый.',       5),
    ('rain',     'дождь',    'Heavy rain.',             'Сильный дождь.',         6),
    ('sun',      'солнце',   'The sun is bright.',      'Солнце яркое.',          7),
    ('cold',     'холодно',  'It''s cold today.',       'Сегодня холодно.',       8),
    ('hot',      'жарко',    'It''s very hot.',         'Очень жарко.',           9),
    ('snow',     'снег',     'The snow is white.',      'Снег белый.',           10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A2' AND c.theme='weather';

-- feelings
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('happy',    'счастливый','I''m happy today.',        'Я сегодня счастлив.',         1),
    ('sad',      'грустный',  'Why are you sad?',         'Почему ты грустный?',         2),
    ('tired',    'уставший',  'I''m very tired.',         'Я очень уставший.',           3),
    ('love',     'любовь',    'My love is here.',         'Моя любовь здесь.',           4),
    ('to want',  'хотеть',    'I want water.',            'Я хочу воды.',                5),
    ('to like',  'нравиться', 'I like coffee.',           'Мне нравится кофе.',          6),
    ('afraid',   'бояться',   'I''m afraid of the dark.', 'Я боюсь темноты.',            7),
    ('angry',    'злой',      'He is angry.',             'Он злой.',                    8),
    ('bored',    'скучно',    'I''m bored.',              'Мне скучно.',                 9),
    ('excited',  'взволнованный','She is excited.',       'Она взволнована.',           10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A2' AND c.theme='feelings';

-- body
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('head',     'голова',    'My head hurts.',           'У меня болит голова.',        1),
    ('hand',     'рука',      'My right hand.',           'Моя правая рука.',            2),
    ('foot',     'нога',      'My foot is cold.',         'Моя нога холодная.',          3),
    ('eye',      'глаз',      'Blue eyes.',               'Голубые глаза.',              4),
    ('mouth',    'рот',       'Open your mouth.',         'Открой рот.',                 5),
    ('to feel',  'чувствовать','I feel good.',            'Я чувствую себя хорошо.',     6),
    ('pain',     'боль',      'A sharp pain.',            'Острая боль.',                7),
    ('doctor',   'врач',      'I need a doctor.',         'Мне нужен врач.',             8),
    ('medicine', 'лекарство', 'Take this medicine.',      'Прими это лекарство.',        9),
    ('to sleep', 'спать',     'I want to sleep.',         'Я хочу спать.',              10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A2' AND c.theme='body';

-- ===== IT A2 =====

-- travel
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('aeroporto',  'аэропорт', 'Sono all''aeroporto.',     'Я в аэропорту.',           1),
    ('biglietto',  'билет',    'Ho un biglietto.',         'У меня есть билет.',        2),
    ('albergo',    'отель',    'Un bell''albergo.',        'Хороший отель.',           3),
    ('passaporto', 'паспорт',  'Mostrami il passaporto.',  'Покажи паспорт.',          4),
    ('treno',      'поезд',    'Il treno è veloce.',       'Поезд быстрый.',           5),
    ('mappa',      'карта',    'Dov''è la mappa?',         'Где карта?',               6),
    ('borsa',      'сумка',    'La mia borsa è pesante.',  'Моя сумка тяжёлая.',       7),
    ('camera',     'комната',  'Una camera pulita.',       'Чистая комната.',          8),
    ('strada',     'улица',    'Una strada lunga.',        'Длинная улица.',           9),
    ('autobus',    'автобус',  'Dov''è l''autobus?',       'Где автобус?',            10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='travel';

-- work
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('ufficio',    'офис',       'Lavoro in ufficio.',         'Я работаю в офисе.',       1),
    ('riunione',   'встреча',    'La riunione è alle 3.',      'Встреча в три.',           2),
    ('email',      'имейл',      'Mandami un''email.',         'Пришли мне имейл.',        3),
    ('capo',       'начальник',  'Il mio capo è gentile.',     'Мой начальник хороший.',   4),
    ('computer',   'компьютер',  'Un computer nuovo.',         'Новый компьютер.',         5),
    ('progetto',   'проект',     'Un grande progetto.',        'Большой проект.',          6),
    ('scadenza',   'срок',       'La scadenza è venerdì.',     'Срок — пятница.',          7),
    ('stipendio',  'зарплата',   'Un buono stipendio.',        'Хорошая зарплата.',        8),
    ('collega',    'коллега',    'Il mio collega è occupato.', 'Мой коллега занят.',       9),
    ('compito',    'задача',     'Un compito difficile.',      'Сложная задача.',         10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='work';

-- weather
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('mattina',  'утро',     'Buona mattina!',         'Доброе утро!',           1),
    ('sera',     'вечер',    'Di sera.',               'Вечером.',               2),
    ('oggi',     'сегодня',  'Oggi lavoro.',           'Я работаю сегодня.',     3),
    ('domani',   'завтра',   'A domani!',              'До завтра!',             4),
    ('anno',     'год',      'Quest''anno è caldo.',   'Этот год тёплый.',       5),
    ('pioggia',  'дождь',    'Pioggia forte.',         'Сильный дождь.',         6),
    ('sole',     'солнце',   'Il sole è luminoso.',    'Солнце яркое.',          7),
    ('freddo',   'холодно',  'Oggi fa freddo.',        'Сегодня холодно.',       8),
    ('caldo',    'жарко',    'Fa molto caldo.',        'Очень жарко.',           9),
    ('neve',     'снег',     'La neve è bianca.',      'Снег белый.',           10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='weather';

-- feelings
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('felice',     'счастливый','Oggi sono felice.',           'Я сегодня счастлив.',         1),
    ('triste',     'грустный',  'Perché sei triste?',          'Почему ты грустный?',         2),
    ('stanco',     'уставший',  'Sono molto stanco.',          'Я очень уставший.',           3),
    ('amore',      'любовь',    'Il mio amore è qui.',         'Моя любовь здесь.',           4),
    ('volere',     'хотеть',    'Voglio dell''acqua.',         'Я хочу воды.',                5),
    ('piacere',    'нравиться', 'Mi piace il caffè.',          'Мне нравится кофе.',          6),
    ('paura',      'страх',     'Ho paura del buio.',          'Я боюсь темноты.',            7),
    ('arrabbiato', 'злой',      'È arrabbiato.',               'Он злой.',                    8),
    ('annoiato',   'скучно',    'Sono annoiato.',              'Мне скучно.',                 9),
    ('emozionato', 'взволнованный','Lei è emozionata.',        'Она взволнована.',           10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='feelings';

-- body
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('testa',     'голова',    'Mi fa male la testa.',         'У меня болит голова.',     1),
    ('mano',      'рука',      'La mia mano destra.',          'Моя правая рука.',         2),
    ('piede',     'нога',      'Il mio piede è freddo.',       'Моя нога холодная.',       3),
    ('occhio',    'глаз',      'Occhi azzurri.',               'Голубые глаза.',           4),
    ('bocca',     'рот',       'Apri la bocca.',               'Открой рот.',              5),
    ('sentirsi',  'чувствовать','Mi sento bene.',              'Я чувствую себя хорошо.',  6),
    ('dolore',    'боль',      'Un dolore forte.',             'Острая боль.',             7),
    ('medico',    'врач',      'Ho bisogno di un medico.',     'Мне нужен врач.',          8),
    ('medicina',  'лекарство', 'Prendi questa medicina.',      'Прими это лекарство.',     9),
    ('dormire',   'спать',     'Voglio dormire.',              'Я хочу спать.',           10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='body';
