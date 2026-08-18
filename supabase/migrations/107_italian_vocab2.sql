-- 107_italian_vocab2.sql
-- Лексика итальянского: Время/часы (A1), Профессии (A2), Технологии (A2), Здоровье (B1).

INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru) VALUES
  ('it', 'A1', 'tempo',       9, 'Время и часы', '⏰', 'ora, giorno, settimana…'),
  ('it', 'A2', 'professioni', 7, 'Профессии',    '💼', 'medico, insegnante, cuoco…'),
  ('it', 'A2', 'tecnologia',  8, 'Технологии',   '💻', 'computer, internet, file…'),
  ('it', 'B1', 'salute',      6, 'Здоровье',     '🏥', 'medicina, febbre, ospedale…')
ON CONFLICT (language, level, theme) DO UPDATE SET
  title_ru = EXCLUDED.title_ru, icon = EXCLUDED.icon,
  description_ru = EXCLUDED.description_ru, order_index = EXCLUDED.order_index;

DELETE FROM public.language_words
WHERE course_id IN (SELECT id FROM public.language_courses
  WHERE language='it' AND theme IN ('tempo','professioni','tecnologia','salute'));

-- Время и часы
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('ora',       'час',     'Che ora è?',               'Который час?',           1),
    ('minuto',    'минута',  'Aspetta un minuto.',       'Подожди минуту.',        2),
    ('giorno',    'день',    'Oggi è un bel giorno.',    'Сегодня хороший день.',  3),
    ('settimana', 'неделя',  'La settimana ha sette giorni.','В неделе семь дней.', 4),
    ('mese',      'месяц',   'Gennaio è il primo mese.', 'Январь — первый месяц.', 5),
    ('anno',      'год',     'Buon anno!',               'С Новым годом!',         6),
    ('oggi',      'сегодня', 'Oggi lavoro.',             'Сегодня я работаю.',     7),
    ('domani',    'завтра',  'Domani è sabato.',         'Завтра суббота.',        8),
    ('ieri',      'вчера',   'Ieri ho dormito molto.',   'Вчера я много спал.',    9),
    ('adesso',    'сейчас',  'Adesso devo andare.',      'Сейчас мне надо идти.',  10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='tempo';

-- Профессии
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('medico',     'врач',       'Il medico lavora in ospedale.', 'Врач работает в больнице.',  1),
    ('insegnante', 'учитель',    'L''insegnante spiega la lezione.','Учитель объясняет урок.',   2),
    ('ingegnere',  'инженер',    'Mio fratello è ingegnere.',     'Мой брат инженер.',          3),
    ('avvocato',   'адвокат',    'L''avvocato difende il cliente.','Адвокат защищает клиента.',  4),
    ('cuoco',      'повар',      'Il cuoco prepara la cena.',     'Повар готовит ужин.',        5),
    ('commesso',   'продавец',   'Il commesso lavora in negozio.','Продавец работает в магазине.',6),
    ('operaio',    'рабочий',    'L''operaio costruisce case.',   'Рабочий строит дома.',       7),
    ('poliziotto', 'полицейский','Il poliziotto aiuta le persone.','Полицейский помогает людям.',8),
    ('infermiere', 'медбрат',    'L''infermiere lavora di notte.','Медбрат работает ночью.',    9),
    ('architetto', 'архитектор', 'L''architetto disegna palazzi.','Архитектор проектирует здания.',10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='professioni';

-- Технологии
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('computer',     'компьютер',  'Lavoro al computer.',        'Я работаю за компьютером.', 1),
    ('telefono',     'телефон',    'Il telefono squilla.',       'Телефон звонит.',           2),
    ('internet',     'интернет',   'Cerco su internet.',         'Я ищу в интернете.',        3),
    ('schermo',      'экран',      'Lo schermo è grande.',       'Экран большой.',            4),
    ('tastiera',     'клавиатура', 'Scrivo sulla tastiera.',     'Я печатаю на клавиатуре.',  5),
    ('file',         'файл',       'Salva il file.',             'Сохрани файл.',             6),
    ('messaggio',    'сообщение',  'Ho ricevuto un messaggio.',  'Я получил сообщение.',      7),
    ('applicazione', 'приложение', 'Scarico un''applicazione.',  'Я скачиваю приложение.',    8),
    ('password',     'пароль',     'Non ricordo la password.',   'Я не помню пароль.',        9),
    ('batteria',     'батарея',    'La batteria è scarica.',     'Батарея разряжена.',        10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='tecnologia';

-- Здоровье
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('salute',      'здоровье',          'La salute è importante.',        'Здоровье важно.',           1),
    ('malato',      'больной',           'Oggi sono malato.',              'Сегодня я болен.',          2),
    ('medicina',    'лекарство',         'Prendo la medicina.',            'Я принимаю лекарство.',     3),
    ('febbre',      'температура, жар',  'Ho la febbre.',                  'У меня температура.',       4),
    ('dolore',      'боль',              'Ho un dolore alla schiena.',     'У меня боль в спине.',      5),
    ('ospedale',    'больница',          'Vado all''ospedale.',            'Я иду в больницу.',         6),
    ('raffreddore', 'простуда',          'Ho preso un raffreddore.',       'Я простудился.',            7),
    ('farmacia',    'аптека',            'Compro le medicine in farmacia.','Покупаю лекарства в аптеке.',8),
    ('guarire',     'выздоравливать',    'Spero di guarire presto.',       'Надеюсь скоро выздороветь.',9),
    ('riposare',    'отдыхать',          'Devi riposare.',                 'Тебе нужно отдохнуть.',     10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='B1' AND c.theme='salute';
