-- 116_italian_vocab_expand.sql
-- Углубление базовых тем A1: +10 слов в greetings/family/food/daily.
-- Вставка с order_index 21+; существующие слова (1..10) НЕ трогаем.

DELETE FROM public.language_words
WHERE course_id IN (SELECT id FROM public.language_courses
  WHERE language='it' AND level='A1' AND theme IN ('greetings','family','food','daily'))
  AND order_index >= 21;

-- greetings +10
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('prego',       'пожалуйста (не за что)', 'Grazie! — Prego.',        'Спасибо! — Пожалуйста.',          21),
    ('buonanotte',  'спокойной ночи',         'Buonanotte, a domani.',   'Спокойной ночи, до завтра.',      22),
    ('per favore',  'пожалуйста (просьба)',   'Un caffè, per favore.',   'Кофе, пожалуйста.',               23),
    ('a presto',    'до скорого',             'Ci vediamo, a presto!',   'Увидимся, до скорого!',           24),
    ('come stai',   'как дела?',              'Ciao, come stai?',        'Привет, как дела?',               25),
    ('bene',        'хорошо',                 'Sto bene, grazie.',       'У меня всё хорошо, спасибо.',      26),
    ('piacere',     'приятно познакомиться',  'Piacere, sono Marco.',    'Приятно, я Марко.',               27),
    ('mi chiamo',   'меня зовут',             'Mi chiamo Anna.',         'Меня зовут Анна.',                28),
    ('salve',       'здравствуйте',           'Salve, come va?',         'Здравствуйте, как дела?',         29),
    ('benvenuto',   'добро пожаловать',       'Benvenuto a Roma!',       'Добро пожаловать в Рим!',         30)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='greetings';

-- family +10
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('nonno',   'дедушка',           'Il nonno legge il giornale.', 'Дедушка читает газету.',        21),
    ('nonna',   'бабушка',           'La nonna cucina bene.',       'Бабушка хорошо готовит.',       22),
    ('zio',     'дядя',              'Mio zio vive a Milano.',      'Мой дядя живёт в Милане.',      23),
    ('zia',     'тётя',              'La zia arriva domani.',       'Тётя приезжает завтра.',        24),
    ('cugino',  'двоюродный брат',   'Il cugino gioca a calcio.',   'Двоюродный брат играет в футбол.',25),
    ('marito',  'муж',               'Suo marito è medico.',        'Её муж врач.',                  26),
    ('moglie',  'жена',              'Sua moglie è insegnante.',    'Его жена учительница.',         27),
    ('nipote',  'внук, племянник',   'Il nipote è piccolo.',        'Внук маленький.',               28),
    ('ragazzo', 'парень',            'Il suo ragazzo è simpatico.', 'Её парень симпатичный.',        29),
    ('ragazza', 'девушка',           'La sua ragazza studia qui.',  'Его девушка учится здесь.',     30)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='family';

-- food +10
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('pizza',    'пицца',          'La pizza è buona.',          'Пицца вкусная.',          21),
    ('pasta',    'паста',          'Mangio la pasta.',           'Я ем пасту.',             22),
    ('pollo',    'курица',         'Il pollo è cotto.',          'Курица готова.',          23),
    ('uovo',     'яйцо',           'Mangio un uovo.',            'Я ем яйцо.',              24),
    ('riso',     'рис',            'Il riso è bianco.',          'Рис белый.',              25),
    ('insalata', 'салат',          'Preparo un''insalata.',      'Я готовлю салат.',        26),
    ('frutta',   'фрукты',         'La frutta è fresca.',        'Фрукты свежие.',          27),
    ('verdura',  'овощи',          'Mangio molta verdura.',      'Я ем много овощей.',      28),
    ('dolce',    'десерт, сладкое','Il dolce è buonissimo.',     'Десерт очень вкусный.',   29),
    ('sale',     'соль',           'Manca il sale.',             'Не хватает соли.',        30)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='food';

-- daily +10
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('scuola',   'школа',     'Vado a scuola.',              'Я иду в школу.',              21),
    ('ufficio',  'офис',      'Lavoro in ufficio.',          'Я работаю в офисе.',          22),
    ('vita',     'жизнь',     'La vita è bella.',            'Жизнь прекрасна.',            23),
    ('nome',     'имя',       'Qual è il tuo nome?',         'Как твоё имя?',               24),
    ('gente',    'люди',      'C''è molta gente.',           'Здесь много людей.',          25),
    ('cosa',     'вещь, что', 'Che cosa fai?',               'Что ты делаешь?',             26),
    ('parola',   'слово',     'Non capisco questa parola.',  'Я не понимаю это слово.',     27),
    ('festa',    'праздник',  'Domani c''è una festa.',      'Завтра праздник.',            28),
    ('problema', 'проблема',  'C''è un problema.',           'Есть проблема.',              29),
    ('storia',   'история',   'Mi piace la storia.',         'Мне нравится история.',       30)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='daily';
