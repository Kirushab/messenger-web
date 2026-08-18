-- 113_italian_vocab3.sql
-- Лексика итальянского: Животные (A1), Глаголы (A1), Природа (A2), Транспорт (A2).

INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru) VALUES
  ('it', 'A1', 'animali',   10, 'Животные',  '🐾', 'cane, gatto, cavallo…'),
  ('it', 'A1', 'verbi',     11, 'Глаголы',   '🏃', 'mangiare, andare, fare…'),
  ('it', 'A2', 'natura',     9, 'Природа',   '🌳', 'albero, mare, montagna…'),
  ('it', 'A2', 'trasporti', 10, 'Транспорт', '🚗', 'treno, autobus, aereo…')
ON CONFLICT (language, level, theme) DO UPDATE SET
  title_ru = EXCLUDED.title_ru, icon = EXCLUDED.icon,
  description_ru = EXCLUDED.description_ru, order_index = EXCLUDED.order_index;

DELETE FROM public.language_words
WHERE course_id IN (SELECT id FROM public.language_courses
  WHERE language='it' AND theme IN ('animali','verbi','natura','trasporti'));

-- Животные
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('cane',     'собака', 'Il cane abbaia.',          'Собака лает.',         1),
    ('gatto',    'кот',    'Il gatto dorme.',          'Кот спит.',            2),
    ('cavallo',  'лошадь', 'Il cavallo corre.',        'Лошадь бежит.',        3),
    ('uccello',  'птица',  'L''uccello vola.',         'Птица летит.',         4),
    ('pesce',    'рыба',   'Il pesce nuota.',          'Рыба плывёт.',         5),
    ('mucca',    'корова', 'La mucca mangia l''erba.', 'Корова ест траву.',    6),
    ('topo',     'мышь',   'Il gatto caccia il topo.', 'Кот ловит мышь.',      7),
    ('leone',    'лев',    'Il leone è forte.',        'Лев сильный.',         8),
    ('coniglio', 'кролик', 'Il coniglio è veloce.',    'Кролик быстрый.',      9),
    ('ape',      'пчела',  'L''ape fa il miele.',      'Пчела делает мёд.',    10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='animali';

-- Глаголы
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('mangiare', 'есть',    'Mangio una mela.',       'Я ем яблоко.',            1),
    ('bere',     'пить',    'Bevo acqua.',            'Я пью воду.',             2),
    ('andare',   'идти',    'Vado a scuola.',         'Я иду в школу.',          3),
    ('venire',   'приходить','Vieni con me?',         'Пойдёшь со мной?',        4),
    ('fare',     'делать',  'Cosa fai?',              'Что ты делаешь?',         5),
    ('vedere',   'видеть',  'Vedo il mare.',          'Я вижу море.',            6),
    ('parlare',  'говорить','Parlo italiano.',        'Я говорю по-итальянски.', 7),
    ('leggere',  'читать',  'Leggo un libro.',        'Я читаю книгу.',          8),
    ('scrivere', 'писать',  'Scrivo una lettera.',    'Я пишу письмо.',          9),
    ('dormire',  'спать',   'Dormo otto ore.',        'Я сплю восемь часов.',    10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='verbi';

-- Природа
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('albero',   'дерево', 'L''albero è alto.',        'Дерево высокое.',     1),
    ('fiore',    'цветок', 'Il fiore è bello.',        'Цветок красивый.',    2),
    ('mare',     'море',   'Il mare è calmo.',         'Море спокойное.',     3),
    ('montagna', 'гора',   'La montagna è alta.',      'Гора высокая.',       4),
    ('fiume',    'река',   'Il fiume scorre.',         'Река течёт.',         5),
    ('bosco',    'лес',    'Il bosco è verde.',        'Лес зелёный.',        6),
    ('cielo',    'небо',   'Il cielo è azzurro.',      'Небо голубое.',       7),
    ('sole',     'солнце', 'Il sole splende.',         'Солнце светит.',      8),
    ('luna',     'луна',   'La luna è piena.',         'Луна полная.',        9),
    ('spiaggia', 'пляж',   'La spiaggia è affollata.', 'Пляж переполнен.',    10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='natura';

-- Транспорт
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('macchina',   'машина',    'Vado in macchina.',       'Я еду на машине.',        1),
    ('treno',      'поезд',     'Prendo il treno.',        'Я сажусь на поезд.',      2),
    ('autobus',    'автобус',   'L''autobus è in ritardo.','Автобус опаздывает.',     3),
    ('aereo',      'самолёт',   'L''aereo decolla.',       'Самолёт взлетает.',       4),
    ('bicicletta', 'велосипед', 'Vado in bicicletta.',     'Я еду на велосипеде.',    5),
    ('nave',       'корабль',   'La nave è grande.',       'Корабль большой.',        6),
    ('taxi',       'такси',     'Chiamo un taxi.',         'Я вызываю такси.',        7),
    ('metro',      'метро',     'Prendo la metro.',        'Я еду на метро.',         8),
    ('moto',       'мотоцикл',  'Ha una moto nuova.',      'У него новый мотоцикл.',  9),
    ('biglietto',  'билет',     'Compro il biglietto.',    'Я покупаю билет.',        10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='trasporti';
