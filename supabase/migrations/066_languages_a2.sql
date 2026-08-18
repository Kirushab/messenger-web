-- ============================================================
-- 066_languages_a2.sql
-- A2 контент: 5 новых тем × 2 языка × 10 слов = 100 слов.
-- Темы: travel, work, time, feelings, body.
-- Открываются после прохождения всех A1 тем (логика в фронте).
-- ============================================================

-- ============ ТЕМЫ A2 ============

INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru) VALUES
  ('en', 'A2', 'travel',   1, 'Путешествия',      '✈️', 'Аэропорт, гостиница, билеты'),
  ('en', 'A2', 'work',     2, 'Работа',           '💼', 'Офис, встречи, проекты'),
  ('en', 'A2', 'time',     3, 'Время и погода',   '⏰', 'Утро, неделя, месяц, дождь'),
  ('en', 'A2', 'feelings', 4, 'Чувства',          '😊', 'Радость, грусть, усталость'),
  ('en', 'A2', 'body',     5, 'Тело и здоровье',  '🩺', 'Голова, рука, доктор, лекарство'),
  ('it', 'A2', 'travel',   1, 'Путешествия',      '✈️', 'Аэропорт, гостиница, билеты'),
  ('it', 'A2', 'work',     2, 'Работа',           '💼', 'Офис, встречи, проекты'),
  ('it', 'A2', 'time',     3, 'Время и погода',   '⏰', 'Утро, неделя, месяц, дождь'),
  ('it', 'A2', 'feelings', 4, 'Чувства',          '😊', 'Радость, грусть, усталость'),
  ('it', 'A2', 'body',     5, 'Тело и здоровье',  '🩺', 'Голова, рука, доктор, лекарство')
ON CONFLICT (language, level, theme) DO UPDATE SET
  title_ru = EXCLUDED.title_ru,
  icon     = EXCLUDED.icon,
  description_ru = EXCLUDED.description_ru,
  order_index    = EXCLUDED.order_index;

-- ============ СЛОВА ============
-- Чистим только A2 чтобы не задеть A1
DELETE FROM public.language_words
WHERE course_id IN (SELECT id FROM public.language_courses WHERE level = 'A2');

-- ===== EN A2 =====

-- travel
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('airport',    'аэропорт',  'I''m at the airport.',     'Я в аэропорту.',           1),
    ('hotel',      'гостиница', 'A nice hotel.',            'Хорошая гостиница.',       2),
    ('ticket',     'билет',     'A train ticket.',          'Билет на поезд.',          3),
    ('station',    'станция',   'The bus station.',         'Автобусная станция.',      4),
    ('suitcase',   'чемодан',   'My suitcase is heavy.',    'Мой чемодан тяжёлый.',     5),
    ('map',        'карта',     'I need a map.',            'Мне нужна карта.',         6),
    ('plane',      'самолёт',   'The plane is late.',       'Самолёт опаздывает.',      7),
    ('train',      'поезд',     'A fast train.',            'Быстрый поезд.',           8),
    ('bus',        'автобус',   'A red bus.',               'Красный автобус.',         9),
    ('taxi',       'такси',     'I take a taxi.',           'Я беру такси.',           10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A2' AND c.theme='travel';

-- work
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('office',    'офис',       'My office is small.',       'Мой офис маленький.',       1),
    ('meeting',   'встреча',    'A long meeting.',           'Долгая встреча.',           2),
    ('computer',  'компьютер',  'A new computer.',           'Новый компьютер.',          3),
    ('email',     'почта',      'I check email.',            'Я проверяю почту.',         4),
    ('project',   'проект',     'A big project.',            'Большой проект.',           5),
    ('colleague', 'коллега',    'My colleague is kind.',     'Мой коллега добрый.',       6),
    ('boss',      'начальник',  'My boss is busy.',          'Мой начальник занят.',      7),
    ('salary',    'зарплата',   'A good salary.',            'Хорошая зарплата.',         8),
    ('deadline',  'дедлайн',    'The deadline is Friday.',   'Дедлайн в пятницу.',        9),
    ('client',    'клиент',     'A new client.',             'Новый клиент.',            10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A2' AND c.theme='work';

-- time
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('morning',  'утро',     'Good morning!',          'Доброе утро!',           1),
    ('evening',  'вечер',    'A quiet evening.',       'Тихий вечер.',           2),
    ('week',     'неделя',   'Next week.',             'На следующей неделе.',   3),
    ('month',    'месяц',    'This month.',            'В этом месяце.',         4),
    ('year',     'год',      'A new year.',            'Новый год.',             5),
    ('sun',      'солнце',   'The sun is hot.',        'Солнце жаркое.',         6),
    ('rain',     'дождь',    'Heavy rain.',            'Сильный дождь.',         7),
    ('snow',     'снег',     'White snow.',            'Белый снег.',            8),
    ('wind',     'ветер',    'A cold wind.',           'Холодный ветер.',        9),
    ('cold',     'холодный', 'It''s cold today.',      'Сегодня холодно.',      10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A2' AND c.theme='time';

-- feelings
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('happy',    'счастливый', 'I''m happy today.',      'Я счастлив сегодня.',     1),
    ('sad',      'грустный',   'A sad story.',           'Грустная история.',       2),
    ('tired',    'уставший',   'I''m very tired.',       'Я очень уставший.',       3),
    ('hungry',   'голодный',   'I''m hungry.',           'Я голодный.',             4),
    ('thirsty',  'жажда',      'I''m thirsty.',          'Я хочу пить.',            5),
    ('angry',    'злой',       'Don''t be angry.',       'Не злись.',               6),
    ('scared',   'испуганный', 'He looks scared.',       'Он выглядит испуганным.', 7),
    ('love',     'любовь',     'I love you.',            'Я люблю тебя.',           8),
    ('fun',      'веселье',    'It''s fun!',             'Это весело!',             9),
    ('surprise', 'сюрприз',    'What a surprise!',       'Вот это сюрприз!',       10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A2' AND c.theme='feelings';

-- body
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('head',     'голова',    'My head hurts.',          'У меня болит голова.',     1),
    ('eye',      'глаз',      'Blue eyes.',              'Голубые глаза.',           2),
    ('hand',     'рука',      'Wash your hands.',        'Помой руки.',              3),
    ('foot',     'нога',      'My foot is cold.',        'У меня замёрзла нога.',    4),
    ('heart',    'сердце',    'A kind heart.',           'Доброе сердце.',           5),
    ('doctor',   'доктор',    'I need a doctor.',        'Мне нужен врач.',          6),
    ('medicine', 'лекарство', 'Take the medicine.',      'Прими лекарство.',         7),
    ('hospital', 'больница',  'A big hospital.',         'Большая больница.',        8),
    ('pain',     'боль',      'I feel pain.',            'Я чувствую боль.',         9),
    ('healthy',  'здоровый',  'A healthy meal.',         'Здоровая еда.',           10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A2' AND c.theme='body';

-- ===== IT A2 =====

-- travel
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('aeroporto', 'аэропорт', 'Sono all''aeroporto.',          'Я в аэропорту.',           1),
    ('albergo',   'гостиница','Un bell''albergo.',             'Хорошая гостиница.',       2),
    ('biglietto', 'билет',    'Un biglietto del treno.',       'Билет на поезд.',          3),
    ('stazione',  'станция',  'La stazione degli autobus.',    'Автобусная станция.',      4),
    ('valigia',   'чемодан',  'La mia valigia è pesante.',     'Мой чемодан тяжёлый.',     5),
    ('mappa',     'карта',    'Ho bisogno di una mappa.',      'Мне нужна карта.',         6),
    ('aereo',     'самолёт',  'L''aereo è in ritardo.',        'Самолёт опаздывает.',      7),
    ('treno',     'поезд',    'Un treno veloce.',              'Быстрый поезд.',           8),
    ('autobus',   'автобус',  'Un autobus rosso.',             'Красный автобус.',         9),
    ('taxi',      'такси',    'Prendo un taxi.',               'Я беру такси.',           10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='travel';

-- work
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('ufficio',   'офис',       'Il mio ufficio è piccolo.',     'Мой офис маленький.',     1),
    ('riunione',  'встреча',    'Una lunga riunione.',           'Долгая встреча.',         2),
    ('computer',  'компьютер',  'Un computer nuovo.',            'Новый компьютер.',        3),
    ('email',     'почта',      'Controllo l''email.',           'Я проверяю почту.',       4),
    ('progetto',  'проект',     'Un grande progetto.',           'Большой проект.',         5),
    ('collega',   'коллега',    'Il mio collega è gentile.',     'Мой коллега добрый.',     6),
    ('capo',      'начальник',  'Il mio capo è occupato.',       'Мой начальник занят.',    7),
    ('stipendio', 'зарплата',   'Un buon stipendio.',            'Хорошая зарплата.',       8),
    ('scadenza',  'дедлайн',    'La scadenza è venerdì.',        'Дедлайн в пятницу.',      9),
    ('cliente',   'клиент',     'Un nuovo cliente.',             'Новый клиент.',          10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='work';

-- time
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('mattina',   'утро',     'Buongiorno!',              'Доброе утро!',           1),
    ('sera',      'вечер',    'Una sera tranquilla.',     'Тихий вечер.',           2),
    ('settimana', 'неделя',   'La prossima settimana.',   'На следующей неделе.',   3),
    ('mese',      'месяц',    'Questo mese.',             'В этом месяце.',         4),
    ('anno',      'год',      'Un nuovo anno.',           'Новый год.',             5),
    ('sole',      'солнце',   'Il sole è caldo.',         'Солнце жаркое.',         6),
    ('pioggia',   'дождь',    'Pioggia forte.',           'Сильный дождь.',         7),
    ('neve',      'снег',     'Neve bianca.',             'Белый снег.',            8),
    ('vento',     'ветер',    'Un vento freddo.',         'Холодный ветер.',        9),
    ('freddo',    'холодный', 'Oggi fa freddo.',          'Сегодня холодно.',      10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='time';

-- feelings
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('felice',      'счастливый', 'Sono felice oggi.',         'Я счастлив сегодня.',     1),
    ('triste',      'грустный',   'Una storia triste.',        'Грустная история.',       2),
    ('stanco',      'уставший',   'Sono molto stanco.',        'Я очень уставший.',       3),
    ('affamato',    'голодный',   'Sono affamato.',            'Я голодный.',             4),
    ('assetato',    'жажда',      'Sono assetato.',            'Я хочу пить.',            5),
    ('arrabbiato',  'злой',       'Non essere arrabbiato.',    'Не злись.',               6),
    ('spaventato',  'испуганный', 'Sembra spaventato.',        'Он выглядит испуганным.', 7),
    ('amore',       'любовь',     'Ti amo.',                   'Я люблю тебя.',           8),
    ('divertimento','веселье',    'Che divertimento!',         'Это весело!',             9),
    ('sorpresa',    'сюрприз',    'Che sorpresa!',             'Вот это сюрприз!',       10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='feelings';

-- body
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('testa',     'голова',    'Mi fa male la testa.',       'У меня болит голова.',     1),
    ('occhio',    'глаз',      'Occhi azzurri.',             'Голубые глаза.',           2),
    ('mano',      'рука',      'Lavati le mani.',            'Помой руки.',              3),
    ('piede',     'нога',      'Ho freddo ai piedi.',        'У меня замёрзли ноги.',    4),
    ('cuore',     'сердце',    'Un cuore gentile.',          'Доброе сердце.',           5),
    ('dottore',   'доктор',    'Ho bisogno di un dottore.',  'Мне нужен врач.',          6),
    ('medicina',  'лекарство', 'Prendi la medicina.',        'Прими лекарство.',         7),
    ('ospedale',  'больница',  'Un grande ospedale.',        'Большая больница.',        8),
    ('dolore',    'боль',      'Sento dolore.',              'Я чувствую боль.',         9),
    ('sano',      'здоровый',  'Un pasto sano.',             'Здоровая еда.',           10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='body';
