-- 108_italian_b2.sql
-- Итальянский B2: расширяем CHECK уровней, добавляем 4 темы со словами.

ALTER TABLE public.language_courses DROP CONSTRAINT IF EXISTS language_courses_level_check;
ALTER TABLE public.language_courses
  ADD CONSTRAINT language_courses_level_check
  CHECK (level IN ('A1','A2','B1','B2','IELTS','CILS'));

INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru) VALUES
  ('it', 'B2', 'lavoro_pro', 1, 'Карьера',             '💼', 'colloquio, stipendio, contratto…'),
  ('it', 'B2', 'cultura',    2, 'Культура и искусство','🎭', 'arte, mostra, regista…'),
  ('it', 'B2', 'societa',    3, 'Общество',            '🏛️', 'legge, diritto, governo…'),
  ('it', 'B2', 'idee',       4, 'Идеи и аргументы',    '💭', 'scopo, motivo, soluzione…')
ON CONFLICT (language, level, theme) DO UPDATE SET
  title_ru = EXCLUDED.title_ru, icon = EXCLUDED.icon,
  description_ru = EXCLUDED.description_ru, order_index = EXCLUDED.order_index;

DELETE FROM public.language_words
WHERE course_id IN (SELECT id FROM public.language_courses
  WHERE language='it' AND level='B2' AND theme IN ('lavoro_pro','cultura','societa','idee'));

-- Карьера
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('colloquio', 'собеседование','Ho un colloquio di lavoro domani.', 'У меня собеседование завтра.', 1),
    ('stipendio', 'зарплата',     'Lo stipendio è buono.',             'Зарплата хорошая.',           2),
    ('azienda',   'компания',     'Lavoro in una grande azienda.',     'Я работаю в большой компании.',3),
    ('riunione',  'совещание',    'La riunione è alle dieci.',         'Совещание в десять.',         4),
    ('contratto', 'контракт',     'Ho firmato il contratto.',          'Я подписал контракт.',        5),
    ('dipendente','сотрудник',    'L''azienda ha cento dipendenti.',   'В компании сто сотрудников.',  6),
    ('capo',      'начальник',    'Il mio capo è severo.',             'Мой начальник строгий.',      7),
    ('esperienza','опыт',         'Ho molta esperienza.',              'У меня большой опыт.',        8),
    ('candidato', 'кандидат',     'Il candidato è preparato.',         'Кандидат подготовлен.',       9),
    ('assumere',  'нанимать',     'L''azienda vuole assumere due persone.','Компания хочет нанять двоих.',10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='B2' AND c.theme='lavoro_pro';

-- Культура и искусство
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('arte',       'искусство',  'Amo l''arte moderna.',           'Я люблю современное искусство.', 1),
    ('mostra',     'выставка',   'C''è una mostra al museo.',      'В музее выставка.',              2),
    ('spettacolo', 'спектакль',  'Lo spettacolo inizia alle otto.','Спектакль начинается в восемь.', 3),
    ('regista',    'режиссёр',   'Il regista è famoso.',           'Режиссёр известный.',            4),
    ('opera',      'произведение','Questa è la sua opera migliore.','Это его лучшее произведение.',   5),
    ('pubblico',   'публика',    'Il pubblico applaude.',          'Публика аплодирует.',            6),
    ('capolavoro', 'шедевр',     'Il film è un capolavoro.',       'Фильм — шедевр.',                7),
    ('tradizione', 'традиция',   'È una vecchia tradizione.',      'Это старая традиция.',           8),
    ('patrimonio', 'наследие',   'Roma è patrimonio dell''umanità.','Рим — наследие человечества.',  9),
    ('critica',    'критика',    'La critica ha lodato il libro.', 'Критика похвалила книгу.',       10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='B2' AND c.theme='cultura';

-- Общество
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('società',     'общество',     'Viviamo in una società moderna.','Мы живём в современном обществе.',1),
    ('diritto',     'право',        'Ogni cittadino ha dei diritti.', 'У каждого гражданина есть права.',2),
    ('legge',       'закон',        'La legge è uguale per tutti.',   'Закон одинаков для всех.',       3),
    ('cittadino',   'гражданин',    'Sono un cittadino italiano.',    'Я итальянский гражданин.',       4),
    ('libertà',     'свобода',      'La libertà è importante.',       'Свобода важна.',                 5),
    ('uguaglianza', 'равенство',    'Lottiamo per l''uguaglianza.',   'Мы боремся за равенство.',       6),
    ('governo',     'правительство','Il governo ha deciso.',          'Правительство решило.',          7),
    ('elezioni',    'выборы',       'Le elezioni sono a giugno.',     'Выборы в июне.',                 8),
    ('tassa',       'налог',        'Le tasse sono alte.',            'Налоги высокие.',                9),
    ('giustizia',   'справедливость','Vogliamo giustizia.',           'Мы хотим справедливости.',       10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='B2' AND c.theme='societa';

-- Идеи и аргументы
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('idea',       'идея',        'Ho un''idea.',                  'У меня есть идея.',           1),
    ('scopo',      'цель',        'Qual è lo scopo?',              'Какова цель?',                2),
    ('motivo',     'причина',     'Non capisco il motivo.',        'Я не понимаю причину.',       3),
    ('risultato',  'результат',   'Il risultato è positivo.',      'Результат положительный.',    4),
    ('soluzione',  'решение',     'Cerchiamo una soluzione.',      'Мы ищем решение.',            5),
    ('vantaggio',  'преимущество','Questo è un grande vantaggio.', 'Это большое преимущество.',   6),
    ('svantaggio', 'недостаток',  'C''è anche uno svantaggio.',    'Есть и недостаток.',          7),
    ('opinione',   'мнение',      'Rispetto la tua opinione.',     'Я уважаю твоё мнение.',       8),
    ('decisione',  'решение',     'È una decisione difficile.',    'Это трудное решение.',        9),
    ('dubbio',     'сомнение',    'Ho un dubbio.',                 'У меня есть сомнение.',       10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='B2' AND c.theme='idee';
