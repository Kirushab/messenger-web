-- 100_italian_b1.sql
-- Итальянский, уровень B1: 5 тем × ~10 слов с примерами.

INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru) VALUES
  ('it', 'B1', 'citta',        1, 'Город и транспорт', '🏙️', 'Улицы, метро, светофор, билеты'),
  ('it', 'B1', 'media',        2, 'Новости и СМИ',     '📰', 'Газета, статья, интервью'),
  ('it', 'B1', 'ambiente',     3, 'Природа и экология','🌿', 'Среда, загрязнение, переработка'),
  ('it', 'B1', 'opinioni',     4, 'Мнения',            '💬', 'Думать, считать, соглашаться'),
  ('it', 'B1', 'tempo_libero', 5, 'Досуг',             '🎭', 'Кино, концерт, спорт, хобби')
ON CONFLICT (language, level, theme) DO UPDATE SET
  title_ru = EXCLUDED.title_ru, icon = EXCLUDED.icon,
  description_ru = EXCLUDED.description_ru, order_index = EXCLUDED.order_index;

-- Пересоздаём слова B1 it (идемпотентность)
DELETE FROM public.language_words
WHERE course_id IN (SELECT id FROM public.language_courses WHERE language='it' AND level='B1');

-- citta
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('città',          'город',         'Vivo in una grande città.',          'Я живу в большом городе.',          1),
    ('strada',         'улица, дорога', 'Attraversa la strada con attenzione.','Переходи дорогу осторожно.',        2),
    ('semaforo',       'светофор',      'Il semaforo è rosso.',               'Светофор красный.',                 3),
    ('fermata',        'остановка',     'Aspetto alla fermata.',              'Я жду на остановке.',               4),
    ('biglietto',      'билет',         'Ho comprato un biglietto del treno.','Я купил билет на поезд.',           5),
    ('metropolitana',  'метро',         'Prendo la metropolitana ogni giorno.','Я езжу на метро каждый день.',     6),
    ('incrocio',       'перекрёсток',   'Gira a destra all''incrocio.',       'Поверни направо на перекрёстке.',   7),
    ('ponte',          'мост',          'Il ponte attraversa il fiume.',      'Мост пересекает реку.',             8),
    ('quartiere',      'район',         'Abito in un quartiere tranquillo.',  'Я живу в тихом районе.',            9),
    ('traffico',       'движение, пробки','C''è molto traffico stamattina.',  'Сегодня утром много пробок.',       10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='B1' AND c.theme='citta';

-- media
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('notizia',      'новость',     'Ho letto una notizia interessante.', 'Я прочитал интересную новость.',     1),
    ('giornale',     'газета',      'Leggo il giornale ogni mattina.',    'Я читаю газету каждое утро.',        2),
    ('articolo',     'статья',      'Questo articolo è molto lungo.',     'Эта статья очень длинная.',          3),
    ('televisione',  'телевидение', 'Guardo la televisione la sera.',     'Я смотрю телевизор вечером.',        4),
    ('pubblicità',   'реклама',     'La pubblicità è troppo lunga.',      'Реклама слишком длинная.',           5),
    ('giornalista',  'журналист',   'Il giornalista ha scritto la verità.','Журналист написал правду.',         6),
    ('rivista',      'журнал',      'Compro una rivista di moda.',        'Я покупаю журнал о моде.',           7),
    ('intervista',   'интервью',    'Ho visto un''intervista al presidente.','Я видел интервью с президентом.', 8),
    ('canale',       'канал',       'Cambia canale, per favore.',         'Переключи канал, пожалуйста.',       9),
    ('informazione', 'информация',  'Cerco informazioni online.',         'Я ищу информацию в интернете.',      10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='B1' AND c.theme='media';

-- ambiente
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('ambiente',     'окружающая среда','Dobbiamo proteggere l''ambiente.', 'Мы должны защищать окружающую среду.',1),
    ('inquinamento', 'загрязнение',     'L''inquinamento è un grande problema.','Загрязнение — большая проблема.',  2),
    ('rifiuti',      'мусор, отходы',   'Ricicliamo i rifiuti.',            'Мы перерабатываем мусор.',           3),
    ('natura',       'природа',         'Amo la natura.',                   'Я люблю природу.',                   4),
    ('clima',        'климат',          'Il clima sta cambiando.',          'Климат меняется.',                   5),
    ('energia',      'энергия',         'Usiamo energia pulita.',           'Мы используем чистую энергию.',      6),
    ('foresta',      'лес',             'La foresta è molto antica.',       'Лес очень древний.',                 7),
    ('fiume',        'река',            'Il fiume è inquinato.',            'Река загрязнена.',                   8),
    ('riciclare',    'перерабатывать',  'È importante riciclare la plastica.','Важно перерабатывать пластик.',    9),
    ('proteggere',   'защищать',        'Vogliamo proteggere il pianeta.',  'Мы хотим защитить планету.',         10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='B1' AND c.theme='ambiente';

-- opinioni
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('secondo me', 'по-моему',     'Secondo me, hai ragione.',       'По-моему, ты прав.',             1),
    ('pensare',    'думать',       'Penso che sia una buona idea.',  'Я думаю, это хорошая идея.',     2),
    ('credere',    'считать, верить','Credo di sì.',                 'Думаю, да.',                     3),
    ('d''accordo', 'согласен',     'Sono d''accordo con te.',        'Я согласен с тобой.',            4),
    ('opinione',   'мнение',       'Qual è la tua opinione?',        'Какое твоё мнение?',             5),
    ('sembrare',   'казаться',     'Mi sembra giusto.',              'Мне кажется, это правильно.',    6),
    ('forse',      'может быть',   'Forse hai ragione.',             'Возможно, ты прав.',             7),
    ('ragione',    'правота',      'Hai ragione.',                   'Ты прав.',                       8),
    ('sbagliare',  'ошибаться',    'Tutti possono sbagliare.',       'Все могут ошибаться.',           9),
    ('preferire',  'предпочитать', 'Preferisco il tè al caffè.',     'Я предпочитаю чай кофе.',        10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='B1' AND c.theme='opinioni';

-- tempo_libero
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('tempo libero','свободное время','Nel tempo libero leggo.',        'В свободное время я читаю.',     1),
    ('film',        'фильм',          'Ieri ho visto un bel film.',     'Вчера я посмотрел хороший фильм.',2),
    ('concerto',    'концерт',        'Andiamo a un concerto stasera.', 'Сегодня вечером идём на концерт.',3),
    ('museo',       'музей',          'Il museo è chiuso il lunedì.',   'Музей закрыт по понедельникам.', 4),
    ('partita',     'матч',           'Guardiamo la partita insieme.',  'Посмотрим матч вместе.',         5),
    ('viaggiare',   'путешествовать', 'Mi piace viaggiare in estate.',  'Мне нравится путешествовать летом.',6),
    ('ballare',     'танцевать',      'Le piace ballare.',              'Ей нравится танцевать.',         7),
    ('hobby',       'хобби',          'Il mio hobby è la fotografia.',  'Моё хобби — фотография.',        8),
    ('sport',       'спорт',          'Faccio sport tre volte a settimana.','Я занимаюсь спортом три раза в неделю.',9),
    ('divertirsi',  'развлекаться',   'Ci siamo divertiti molto.',      'Мы хорошо повеселились.',        10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='B1' AND c.theme='tempo_libero';
