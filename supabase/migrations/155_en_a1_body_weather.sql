-- ============================================================
-- 155_en_a1_body_weather.sql
-- Бэклог по языкам #7: Английский A1 — добавляем темы «Тело» и «Погода»
-- для начинающих (раньше body/weather были только на A2; A2-версии не трогаем).
-- Идемпотентно: на конфликте по (language, level, theme) обновляются метаданные,
-- слова пересоздаются только для этих двух курсов.
-- ============================================================

-- ===== ТЕМЫ =====
INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru) VALUES
  ('en', 'A1', 'body',    10, 'Тело',   '🧍', 'Голова, рука, глаз, нос'),
  ('en', 'A1', 'weather', 11, 'Погода', '🌤️', 'Солнце, дождь, снег, ветер')
ON CONFLICT (language, level, theme) DO UPDATE SET
  title_ru       = EXCLUDED.title_ru,
  icon           = EXCLUDED.icon,
  description_ru = EXCLUDED.description_ru,
  order_index    = EXCLUDED.order_index;

-- ===== СЛОВА (только для этих двух курсов — безопасно при повторном запуске) =====
DELETE FROM public.language_words WHERE course_id IN (
  SELECT id FROM public.language_courses
  WHERE language = 'en' AND level = 'A1' AND theme IN ('body', 'weather')
);

-- EN A1 · body
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('head',  'голова', 'My head hurts.',     'У меня болит голова.',  1),
    ('hand',  'рука',   'Wash your hands.',   'Помой руки.',           2),
    ('eye',   'глаз',   'I have two eyes.',   'У меня два глаза.',      3),
    ('nose',  'нос',    'My nose is cold.',   'Мой нос холодный.',      4),
    ('mouth', 'рот',    'Open your mouth.',   'Открой рот.',            5),
    ('ear',   'ухо',    'My ear hurts.',      'У меня болит ухо.',      6),
    ('hair',  'волосы', 'She has long hair.', 'У неё длинные волосы.',  7),
    ('leg',   'нога',   'My leg hurts.',      'У меня болит нога.',     8),
    ('tooth', 'зуб',    'My tooth hurts.',    'У меня болит зуб.',      9),
    ('face',  'лицо',   'Wash your face.',    'Умой лицо.',            10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'en' AND c.level = 'A1' AND c.theme = 'body';

-- EN A1 · weather
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('sun',     'солнце',   'The sun is hot.',     'Солнце горячее.',         1),
    ('rain',    'дождь',    'I don''t like rain.', 'Я не люблю дождь.',       2),
    ('snow',    'снег',     'White snow.',         'Белый снег.',             3),
    ('wind',    'ветер',    'A cold wind.',        'Холодный ветер.',         4),
    ('cloud',   'облако',   'A white cloud.',      'Белое облако.',           5),
    ('hot',     'жаркий',   'Today is hot.',       'Сегодня жарко.',          6),
    ('cold',    'холодный', 'It is cold today.',   'Сегодня холодно.',        7),
    ('warm',    'тёплый',   'Warm weather.',       'Тёплая погода.',          8),
    ('sky',     'небо',     'The sky is blue.',    'Небо голубое.',           9),
    ('weather', 'погода',   'Nice weather today.', 'Сегодня хорошая погода.', 10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language = 'en' AND c.level = 'A1' AND c.theme = 'weather';
