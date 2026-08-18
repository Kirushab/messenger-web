-- ============================================================
-- 064_languages_seed.sql
-- Содержимое A1 для английского и итальянского: 5 тем × 10 слов = 50 на язык.
-- Можно запускать повторно — на конфликте по (language, level, theme) обновляются метаданные.
-- ============================================================

-- ============ ТЕМЫ A1 ============

INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru) VALUES
  ('en', 'A1', 'greetings', 1, 'Приветствия',   '👋', 'Здороваемся и прощаемся'),
  ('en', 'A1', 'family',    2, 'Семья',         '👨‍👩‍👧', 'Мама, папа, брат, сестра'),
  ('en', 'A1', 'food',      3, 'Еда',           '🍞', 'Хлеб, вода, яблоко'),
  ('en', 'A1', 'numbers',   4, 'Числа',         '🔢', 'От одного до десяти'),
  ('en', 'A1', 'daily',     5, 'Бытовое',       '🏠', 'Дом, день, ночь, работа'),
  ('it', 'A1', 'greetings', 1, 'Приветствия',   '👋', 'Здороваемся и прощаемся'),
  ('it', 'A1', 'family',    2, 'Семья',         '👨‍👩‍👧', 'Мама, папа, брат, сестра'),
  ('it', 'A1', 'food',      3, 'Еда',           '🍞', 'Хлеб, вода, яблоко'),
  ('it', 'A1', 'numbers',   4, 'Числа',         '🔢', 'От одного до десяти'),
  ('it', 'A1', 'daily',     5, 'Бытовое',       '🏠', 'Дом, день, ночь, работа')
ON CONFLICT (language, level, theme) DO UPDATE SET
  title_ru = EXCLUDED.title_ru,
  icon     = EXCLUDED.icon,
  description_ru = EXCLUDED.description_ru,
  order_index    = EXCLUDED.order_index;

-- ============ СЛОВА ============
-- Для каждого курса 10 слов. Пересоздаём чтобы не было дубликатов при повторе.

DELETE FROM public.language_words
WHERE course_id IN (
  SELECT id FROM public.language_courses WHERE level = 'A1'
);

-- ===== EN A1 =====

-- greetings
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('hello',      'привет',        'Hello, how are you?',     'Привет, как дела?',           1),
    ('goodbye',    'до свидания',   'Goodbye, see you tomorrow.','До свидания, увидимся завтра.',2),
    ('thanks',     'спасибо',       'Thanks for your help.',   'Спасибо за помощь.',           3),
    ('please',     'пожалуйста',    'Water, please.',          'Воды, пожалуйста.',           4),
    ('sorry',      'извини',        'I''m sorry, I''m late.',  'Извини, я опоздал.',           5),
    ('yes',        'да',            'Yes, of course.',         'Да, конечно.',                6),
    ('no',         'нет',           'No, thanks.',             'Нет, спасибо.',               7),
    ('good',       'хороший',       'Good morning!',           'Доброе утро!',                8),
    ('how are you','как дела',      'Hi, how are you?',        'Привет, как дела?',           9),
    ('see you',    'до встречи',    'See you tomorrow.',       'До встречи завтра.',         10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A1' AND c.theme='greetings';

-- family
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('mother',   'мама',     'My mother is kind.',     'Моя мама добрая.',     1),
    ('father',   'папа',     'My father works hard.',  'Мой папа много работает.',2),
    ('brother',  'брат',     'I have one brother.',    'У меня один брат.',    3),
    ('sister',   'сестра',   'My sister is at home.',  'Моя сестра дома.',     4),
    ('son',      'сын',      'Their son is five.',     'Их сыну пять.',        5),
    ('daughter', 'дочь',     'Her daughter is here.',  'Её дочь здесь.',       6),
    ('parents',  'родители', 'My parents live in Moscow.','Мои родители живут в Москве.',7),
    ('child',    'ребёнок',  'A small child.',         'Маленький ребёнок.',   8),
    ('family',   'семья',    'I love my family.',      'Я люблю свою семью.',  9),
    ('friend',   'друг',     'He is my friend.',       'Он мой друг.',         10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A1' AND c.theme='family';

-- food
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('bread',  'хлеб',  'I eat bread.',           'Я ем хлеб.',           1),
    ('water',  'вода',  'I drink water.',         'Я пью воду.',          2),
    ('apple',  'яблоко','A red apple.',           'Красное яблоко.',      3),
    ('milk',   'молоко','Hot milk.',              'Горячее молоко.',      4),
    ('cheese', 'сыр',   'I love cheese.',         'Я люблю сыр.',         5),
    ('coffee', 'кофе',  'A cup of coffee.',       'Чашка кофе.',          6),
    ('tea',    'чай',   'Green tea.',             'Зелёный чай.',         7),
    ('meat',   'мясо',  'I eat meat.',            'Я ем мясо.',           8),
    ('fish',   'рыба',  'Fresh fish.',            'Свежая рыба.',         9),
    ('sugar',  'сахар', 'Sugar in tea, please.',  'Сахар в чай, пожалуйста.',10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A1' AND c.theme='food';

-- numbers
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, NULL, NULL, w.ord FROM public.language_courses c,
  (VALUES
    ('one',   'один',    1),
    ('two',   'два',     2),
    ('three', 'три',     3),
    ('four',  'четыре',  4),
    ('five',  'пять',    5),
    ('six',   'шесть',   6),
    ('seven', 'семь',    7),
    ('eight', 'восемь',  8),
    ('nine',  'девять',  9),
    ('ten',   'десять', 10)
  ) AS w(word, tr, ord)
WHERE c.language='en' AND c.level='A1' AND c.theme='numbers';

-- daily
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('house',   'дом',    'A big house.',            'Большой дом.',         1),
    ('day',     'день',   'A good day.',             'Хороший день.',        2),
    ('night',   'ночь',   'Good night!',             'Спокойной ночи!',      3),
    ('work',    'работа', 'I go to work.',           'Я иду на работу.',     4),
    ('book',    'книга',  'A new book.',             'Новая книга.',         5),
    ('time',    'время',  'What time is it?',        'Который час?',         6),
    ('money',   'деньги', 'I have no money.',        'У меня нет денег.',    7),
    ('phone',   'телефон','My phone is here.',       'Мой телефон здесь.',   8),
    ('car',     'машина', 'A fast car.',             'Быстрая машина.',      9),
    ('city',    'город',  'A big city.',             'Большой город.',      10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='A1' AND c.theme='daily';

-- ===== IT A1 =====

-- greetings
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('ciao',         'привет',     'Ciao, come stai?',           'Привет, как дела?',           1),
    ('arrivederci',  'до свидания','Arrivederci, a domani.',     'До свидания, до завтра.',     2),
    ('grazie',       'спасибо',    'Grazie mille!',              'Большое спасибо!',            3),
    ('per favore',   'пожалуйста', 'Acqua, per favore.',         'Воды, пожалуйста.',           4),
    ('scusa',        'извини',     'Scusa, sono in ritardo.',    'Извини, я опоздал.',          5),
    ('sì',           'да',         'Sì, certo.',                 'Да, конечно.',                6),
    ('no',           'нет',        'No, grazie.',                'Нет, спасибо.',               7),
    ('buongiorno',   'доброе утро','Buongiorno a tutti!',        'Доброе утро всем!',           8),
    ('buonasera',    'добрый вечер','Buonasera, signore.',       'Добрый вечер, синьор.',       9),
    ('come stai',    'как дела',   'Ciao, come stai?',           'Привет, как дела?',          10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='greetings';

-- family
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('madre',     'мама',     'Mia madre è gentile.',    'Моя мама добрая.',         1),
    ('padre',     'папа',     'Mio padre lavora molto.', 'Мой папа много работает.', 2),
    ('fratello',  'брат',     'Ho un fratello.',         'У меня один брат.',        3),
    ('sorella',   'сестра',   'Mia sorella è a casa.',   'Моя сестра дома.',         4),
    ('figlio',    'сын',      'Loro figlio ha cinque anni.','Их сыну пять лет.',     5),
    ('figlia',    'дочь',     'Sua figlia è qui.',       'Её дочь здесь.',           6),
    ('genitori',  'родители', 'I miei genitori vivono a Roma.','Мои родители живут в Риме.',7),
    ('bambino',   'ребёнок',  'Un bambino piccolo.',     'Маленький ребёнок.',       8),
    ('famiglia',  'семья',    'Amo la mia famiglia.',    'Я люблю свою семью.',      9),
    ('amico',     'друг',     'È mio amico.',            'Он мой друг.',             10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='family';

-- food
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('pane',      'хлеб',  'Mangio il pane.',         'Я ем хлеб.',             1),
    ('acqua',     'вода',  'Bevo acqua.',             'Я пью воду.',            2),
    ('mela',      'яблоко','Una mela rossa.',         'Красное яблоко.',        3),
    ('latte',     'молоко','Latte caldo.',            'Горячее молоко.',        4),
    ('formaggio', 'сыр',   'Amo il formaggio.',       'Я люблю сыр.',           5),
    ('caffè',     'кофе',  'Una tazza di caffè.',     'Чашка кофе.',            6),
    ('tè',        'чай',   'Tè verde.',               'Зелёный чай.',           7),
    ('carne',     'мясо',  'Mangio la carne.',        'Я ем мясо.',             8),
    ('pesce',     'рыба',  'Pesce fresco.',           'Свежая рыба.',           9),
    ('zucchero',  'сахар', 'Zucchero nel tè, per favore.','Сахар в чай, пожалуйста.',10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='food';

-- numbers
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, NULL, NULL, w.ord FROM public.language_courses c,
  (VALUES
    ('uno',     'один',    1),
    ('due',     'два',     2),
    ('tre',     'три',     3),
    ('quattro', 'четыре',  4),
    ('cinque',  'пять',    5),
    ('sei',     'шесть',   6),
    ('sette',   'семь',    7),
    ('otto',    'восемь',  8),
    ('nove',    'девять',  9),
    ('dieci',   'десять', 10)
  ) AS w(word, tr, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='numbers';

-- daily
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('casa',      'дом',    'Una casa grande.',         'Большой дом.',         1),
    ('giorno',    'день',   'Un buon giorno.',          'Хороший день.',        2),
    ('notte',     'ночь',   'Buona notte!',             'Спокойной ночи!',      3),
    ('lavoro',    'работа', 'Vado al lavoro.',          'Я иду на работу.',     4),
    ('libro',     'книга',  'Un libro nuovo.',          'Новая книга.',         5),
    ('tempo',     'время',  'Che ora è?',               'Который час?',         6),
    ('soldi',     'деньги', 'Non ho soldi.',            'У меня нет денег.',    7),
    ('telefono',  'телефон','Il mio telefono è qui.',   'Мой телефон здесь.',   8),
    ('macchina',  'машина', 'Una macchina veloce.',     'Быстрая машина.',      9),
    ('città',     'город',  'Una grande città.',        'Большой город.',      10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='daily';
