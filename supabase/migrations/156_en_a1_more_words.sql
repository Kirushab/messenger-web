-- ============================================================
-- 156_en_a1_more_words.sql
-- Бэклог по языкам #8: больше слов на тему. Английский A1 — добавляем
-- по 7–8 новых слов в food / family / daily.
-- Аддитивно и идемпотентно: вставляются только слова, которых ещё нет
-- в курсе (NOT EXISTS по (course_id, word)). Существующие слова не трогаются.
-- ============================================================

-- EN A1 · food (+8)
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('egg',     'яйцо',      'I eat an egg.',        'Я ем яйцо.',              11),
    ('rice',    'рис',       'Rice and fish.',       'Рис и рыба.',             12),
    ('soup',    'суп',       'Hot soup.',            'Горячий суп.',            13),
    ('salt',    'соль',      'Salt, please.',        'Соль, пожалуйста.',       14),
    ('butter',  'масло',     'Bread and butter.',    'Хлеб с маслом.',          15),
    ('juice',   'сок',       'Apple juice.',         'Яблочный сок.',           16),
    ('chicken', 'курица',    'I like chicken.',      'Я люблю курицу.',         17),
    ('potato',  'картофель', 'I like potatoes.',     'Я люблю картофель.',      18)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A1' AND c.theme='food'
  AND NOT EXISTS (SELECT 1 FROM public.language_words lw WHERE lw.course_id = c.id AND lw.word = w.word);

-- EN A1 · family (+7)
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('grandmother', 'бабушка', 'My grandmother is old.',   'Моя бабушка старенькая.', 11),
    ('grandfather', 'дедушка', 'My grandfather is kind.',  'Мой дедушка добрый.',     12),
    ('husband',     'муж',     'Her husband is a doctor.', 'Её муж врач.',            13),
    ('wife',        'жена',    'His wife is here.',        'Его жена здесь.',         14),
    ('aunt',        'тётя',    'My aunt lives near.',      'Моя тётя живёт рядом.',   15),
    ('uncle',       'дядя',    'My uncle has a car.',      'У моего дяди есть машина.',16),
    ('baby',        'малыш',   'A small baby.',            'Маленький малыш.',        17)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A1' AND c.theme='family'
  AND NOT EXISTS (SELECT 1 FROM public.language_words lw WHERE lw.course_id = c.id AND lw.word = w.word);

-- EN A1 · daily (+8)
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT c.id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('door',   'дверь',   'Open the door.',        'Открой дверь.',            11),
    ('window', 'окно',    'A big window.',         'Большое окно.',            12),
    ('table',  'стол',    'Food on the table.',    'Еда на столе.',            13),
    ('chair',  'стул',    'A new chair.',          'Новый стул.',              14),
    ('bed',    'кровать', 'I sleep in my bed.',    'Я сплю в своей кровати.',  15),
    ('room',   'комната', 'A small room.',         'Маленькая комната.',       16),
    ('key',    'ключ',    'My key is here.',       'Мой ключ здесь.',          17),
    ('street', 'улица',   'A long street.',        'Длинная улица.',           18)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A1' AND c.theme='daily'
  AND NOT EXISTS (SELECT 1 FROM public.language_words lw WHERE lw.course_id = c.id AND lw.word = w.word);
