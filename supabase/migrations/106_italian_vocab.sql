-- 106_italian_vocab.sql
-- Расширение лексики итальянского: новые темы (Цвета, Одежда, Дом — A1; Покупки — A2).

INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru) VALUES
  ('it', 'A1', 'colori',   6, 'Цвета',           '🎨', 'rosso, blu, verde…'),
  ('it', 'A1', 'vestiti',  7, 'Одежда',          '👕', 'maglietta, scarpe, giacca…'),
  ('it', 'A1', 'casa',     8, 'Дом',             '🏠', 'camera, cucina, letto…'),
  ('it', 'A2', 'shopping', 6, 'Покупки и деньги','🛒', 'negozio, prezzo, sconto…')
ON CONFLICT (language, level, theme) DO UPDATE SET
  title_ru = EXCLUDED.title_ru, icon = EXCLUDED.icon,
  description_ru = EXCLUDED.description_ru, order_index = EXCLUDED.order_index;

DELETE FROM public.language_words
WHERE course_id IN (SELECT id FROM public.language_courses
  WHERE language='it' AND theme IN ('colori','vestiti','casa','shopping'));

-- Цвета
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('rosso',     'красный',    'Il pomodoro è rosso.',      'Помидор красный.',        1),
    ('blu',       'синий',      'Il cielo è blu.',           'Небо синее.',             2),
    ('verde',     'зелёный',    'L''erba è verde.',          'Трава зелёная.',          3),
    ('giallo',    'жёлтый',     'Il sole è giallo.',         'Солнце жёлтое.',          4),
    ('nero',      'чёрный',     'Il gatto è nero.',          'Кот чёрный.',             5),
    ('bianco',    'белый',      'La neve è bianca.',         'Снег белый.',             6),
    ('rosa',      'розовый',    'Il fiore è rosa.',          'Цветок розовый.',         7),
    ('arancione', 'оранжевый',  'L''arancia è arancione.',   'Апельсин оранжевый.',     8),
    ('grigio',    'серый',      'Oggi il cielo è grigio.',   'Сегодня небо серое.',     9),
    ('marrone',   'коричневый', 'Il cane è marrone.',        'Собака коричневая.',      10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='colori';

-- Одежда
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('maglietta', 'футболка',     'Indosso una maglietta bianca.', 'Я ношу белую футболку.',     1),
    ('pantaloni', 'брюки',        'I pantaloni sono neri.',        'Брюки чёрные.',              2),
    ('scarpe',    'обувь, туфли', 'Le scarpe sono nuove.',         'Туфли новые.',               3),
    ('giacca',    'куртка',       'Fa freddo, prendi la giacca.',  'Холодно, возьми куртку.',    4),
    ('camicia',   'рубашка',      'La camicia è elegante.',        'Рубашка элегантная.',        5),
    ('vestito',   'платье',       'Che bel vestito!',              'Какое красивое платье!',     6),
    ('cappello',  'шляпа',        'Porto un cappello al sole.',    'На солнце ношу шляпу.',      7),
    ('gonna',     'юбка',         'La gonna è rossa.',             'Юбка красная.',              8),
    ('calze',     'носки',        'Le calze sono calde.',          'Носки тёплые.',              9),
    ('cappotto',  'пальто',       'In inverno indosso il cappotto.','Зимой я ношу пальто.',      10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='vestiti';

-- Дом
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('casa',     'дом',            'La mia casa è grande.',       'Мой дом большой.',            1),
    ('camera',   'комната',        'La camera è piccola.',        'Комната маленькая.',          2),
    ('cucina',   'кухня',          'Cucino in cucina.',           'Я готовлю на кухне.',         3),
    ('bagno',    'ванная',         'Il bagno è pulito.',          'Ванная чистая.',              4),
    ('letto',    'кровать',        'Il letto è comodo.',          'Кровать удобная.',            5),
    ('tavolo',   'стол',           'Mangiamo al tavolo.',         'Мы едим за столом.',          6),
    ('sedia',    'стул',           'La sedia è di legno.',        'Стул деревянный.',            7),
    ('porta',    'дверь',          'Chiudi la porta, per favore.','Закрой дверь, пожалуйста.',   8),
    ('finestra', 'окно',           'Apri la finestra.',           'Открой окно.',                9),
    ('divano',   'диван',          'Guardo la TV sul divano.',    'Смотрю телевизор на диване.', 10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A1' AND c.theme='casa';

-- Покупки и деньги
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('negozio',   'магазин',   'Vado al negozio.',            'Я иду в магазин.',            1),
    ('prezzo',    'цена',      'Qual è il prezzo?',           'Какая цена?',                 2),
    ('soldi',     'деньги',    'Non ho soldi.',               'У меня нет денег.',           3),
    ('comprare',  'покупать',  'Voglio comprare il pane.',    'Я хочу купить хлеб.',         4),
    ('pagare',    'платить',   'Pago con la carta.',          'Я плачу картой.',             5),
    ('sconto',    'скидка',    'C''è uno sconto del venti per cento.','Есть скидка 20%.',    6),
    ('cassa',     'касса',     'La cassa è là.',              'Касса там.',                  7),
    ('contante',  'наличные',  'Pago in contanti.',           'Я плачу наличными.',          8),
    ('caro',      'дорогой',   'Questo è troppo caro.',       'Это слишком дорого.',         9),
    ('economico', 'дешёвый',   'Il mercato è economico.',     'Рынок дешёвый.',              10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='A2' AND c.theme='shopping';
