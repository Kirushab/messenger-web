-- 117_italian_vocab_expand2.sql
-- Углубление A2: +10 слов в travel/work/weather. order_index 21+; существующее не трогаем.

DELETE FROM public.language_words
WHERE course_id IN (SELECT id FROM public.language_courses
  WHERE language='it' AND level='A2' AND theme IN ('travel','work','weather'))
  AND order_index >= 21;

-- travel +10
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('valigia',       'чемодан',     'Preparo la valigia.',              'Я собираю чемодан.',        21),
    ('vacanza',       'отпуск',      'Vado in vacanza ad agosto.',       'Я еду в отпуск в августе.', 22),
    ('volo',          'рейс',        'Il volo è in ritardo.',            'Рейс задерживается.',       23),
    ('partenza',      'отправление', 'La partenza è alle nove.',         'Отправление в девять.',     24),
    ('arrivo',        'прибытие',    'L''arrivo è a mezzogiorno.',       'Прибытие в полдень.',       25),
    ('dogana',        'таможня',     'Passiamo la dogana.',              'Проходим таможню.',         26),
    ('prenotazione',  'бронь',       'Ho una prenotazione.',             'У меня есть бронь.',        27),
    ('bagaglio',      'багаж',       'Il bagaglio è pesante.',           'Багаж тяжёлый.',            28),
    ('viaggio',       'поездка',     'Buon viaggio!',                    'Хорошей поездки!',          29),
    ('turista',       'турист',      'Roma è piena di turisti.',         'Рим полон туристов.',       30)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='travel';

-- work +10
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('cliente',      'клиент',           'Il cliente aspetta.',            'Клиент ждёт.',                21),
    ('guadagnare',   'зарабатывать',     'Guadagna bene.',                 'Он хорошо зарабатывает.',     22),
    ('pausa',        'перерыв',          'Faccio una pausa.',              'Я делаю перерыв.',            23),
    ('curriculum',   'резюме',           'Invio il curriculum.',           'Я отправляю резюме.',         24),
    ('disoccupato',  'безработный',      'Adesso è disoccupato.',          'Сейчас он безработный.',      25),
    ('pensione',     'пенсия',           'Va in pensione presto.',         'Он скоро выходит на пенсию.', 26),
    ('turno',        'смена',            'Lavoro il turno di notte.',      'Я работаю в ночную смену.',   27),
    ('ferie',        'отпуск (дни)',     'Ho due settimane di ferie.',     'У меня две недели отпуска.',  28),
    ('responsabile', 'ответственный',    'È responsabile del progetto.',   'Он отвечает за проект.',      29),
    ('impiego',      'работа, должность','Ho trovato un impiego.',         'Я нашёл работу.',             30)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='work';

-- weather +10
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('nuvola',    'облако',   'C''è una nuvola nera.',              'Есть чёрное облако.',     21),
    ('vento',     'ветер',    'Oggi c''è vento.',                   'Сегодня ветрено.',        22),
    ('temporale', 'гроза',    'Arriva un temporale.',               'Приближается гроза.',     23),
    ('nebbia',    'туман',    'C''è molta nebbia.',                 'Густой туман.',           24),
    ('umido',     'влажный',  'Il clima è umido.',                  'Климат влажный.',         25),
    ('sereno',    'ясно',     'Il cielo è sereno.',                 'Небо ясное.',             26),
    ('fresco',    'прохладно','Fa fresco la sera.',                 'Вечером прохладно.',      27),
    ('ghiaccio',  'лёд',      'Attento al ghiaccio!',               'Осторожно, лёд!',         28),
    ('ombrello',  'зонт',     'Prendi l''ombrello.',                'Возьми зонт.',            29),
    ('stagione',  'сезон',    'La mia stagione preferita è l''estate.','Мой любимый сезон — лето.',30)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='weather';
