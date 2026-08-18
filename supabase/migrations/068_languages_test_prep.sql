-- ============================================================
-- 068_languages_test_prep.sql
-- IELTS (английский) и CILS (итальянский) — академическая лексика.
-- Новая «дорожка» параллельно A1→A2. Доступна сразу, не зависит от A1/A2.
-- 5 тем × 2 языка × 10 слов = 100 продвинутых слов.
-- ============================================================

-- Расширяем CHECK constraint чтобы пускал 'IELTS' и 'CILS'
ALTER TABLE public.language_courses DROP CONSTRAINT IF EXISTS language_courses_level_check;
ALTER TABLE public.language_courses
  ADD CONSTRAINT language_courses_level_check
  CHECK (level IN ('A1', 'A2', 'B1', 'IELTS', 'CILS'));

-- ============ ТЕМЫ ============

-- IELTS (английский)
INSERT INTO public.language_courses (language, level, theme, order_index, title_ru, icon, description_ru) VALUES
  ('en', 'IELTS', 'academic_verbs',   1, 'Академические глаголы', '📝', 'analyze, assess, demonstrate'),
  ('en', 'IELTS', 'society',          2, 'Общество и политика',   '🏛️', 'democracy, government, citizen'),
  ('en', 'IELTS', 'environment',      3, 'Природа и климат',      '🌍', 'pollution, renewable, sustainable'),
  ('en', 'IELTS', 'science_health',   4, 'Наука и здоровье',      '🧪', 'research, vaccine, evidence'),
  ('en', 'IELTS', 'tech_innovation',  5, 'Технологии',            '🤖', 'algorithm, AI, automation'),
  -- CILS (итальянский)
  ('it', 'CILS',  'verbi_formali',    1, 'Формальные глаголы',    '📝', 'analizzare, valutare, dimostrare'),
  ('it', 'CILS',  'societa',          2, 'Общество и политика',   '🏛️', 'democrazia, governo, cittadino'),
  ('it', 'CILS',  'ambiente',         3, 'Природа и климат',      '🌍', 'inquinamento, sostenibile'),
  ('it', 'CILS',  'salute_scienza',   4, 'Наука и здоровье',      '🧪', 'ricerca, vaccino, prova'),
  ('it', 'CILS',  'tecnologia',       5, 'Технологии',            '🤖', 'algoritmo, IA, automazione')
ON CONFLICT (language, level, theme) DO UPDATE SET
  title_ru = EXCLUDED.title_ru,
  icon     = EXCLUDED.icon,
  description_ru = EXCLUDED.description_ru,
  order_index    = EXCLUDED.order_index;

-- Пересоздаём слова на случай повторного запуска
DELETE FROM public.language_words
WHERE course_id IN (SELECT id FROM public.language_courses WHERE level IN ('IELTS', 'CILS'));

-- ===== IELTS (en) =====

-- academic_verbs
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('analyze',     'анализировать', 'Researchers analyze the data.',          'Исследователи анализируют данные.',         1),
    ('assess',      'оценивать',     'We need to assess the impact.',          'Нужно оценить влияние.',                    2),
    ('demonstrate', 'демонстрировать','Studies demonstrate this effect.',      'Исследования демонстрируют этот эффект.',   3),
    ('establish',   'устанавливать', 'He established a new theory.',           'Он установил новую теорию.',                4),
    ('evaluate',    'оценивать',     'Let''s evaluate the results.',           'Давайте оценим результаты.',                5),
    ('examine',     'рассматривать', 'Scientists examine the samples.',        'Учёные рассматривают образцы.',             6),
    ('highlight',   'подчёркивать',  'The report highlights key issues.',      'Отчёт подчёркивает ключевые проблемы.',     7),
    ('illustrate',  'иллюстрировать','This case illustrates the problem.',     'Этот случай иллюстрирует проблему.',        8),
    ('imply',       'подразумевать', 'The data imply a clear trend.',          'Данные подразумевают чёткий тренд.',        9),
    ('propose',     'предлагать',    'Experts propose a solution.',            'Эксперты предлагают решение.',             10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='IELTS' AND c.theme='academic_verbs';

-- society
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('citizen',    'гражданин',   'Every citizen has rights.',           'У каждого гражданина есть права.',       1),
    ('democracy',  'демократия',  'Democracy needs free press.',         'Демократии нужна свободная пресса.',     2),
    ('equality',   'равенство',   'They fight for equality.',            'Они борются за равенство.',              3),
    ('freedom',    'свобода',     'Freedom of speech is essential.',     'Свобода слова важна.',                   4),
    ('government', 'правительство','The government raised taxes.',       'Правительство подняло налоги.',          5),
    ('inequality', 'неравенство', 'Income inequality is growing.',       'Неравенство доходов растёт.',            6),
    ('justice',    'справедливость','We demand justice.',                'Мы требуем справедливости.',             7),
    ('policy',     'политика',    'A new economic policy.',              'Новая экономическая политика.',          8),
    ('protest',    'протест',     'A peaceful protest in the city.',     'Мирный протест в городе.',               9),
    ('right',      'право',       'The right to vote.',                  'Право голосовать.',                     10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='IELTS' AND c.theme='society';

-- environment
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('climate',      'климат',           'Climate change is real.',                'Изменение климата реально.',           1),
    ('emission',     'выбросы',          'Carbon emissions must be reduced.',      'Выбросы углерода надо сократить.',     2),
    ('pollution',    'загрязнение',      'Air pollution harms health.',            'Загрязнение воздуха вредит здоровью.', 3),
    ('recycle',      'перерабатывать',   'We recycle plastic bottles.',            'Мы перерабатываем пластиковые бутылки.',4),
    ('renewable',    'возобновляемый',   'Renewable energy is cheaper now.',       'Возобновляемая энергия теперь дешевле.',5),
    ('sustainable',  'устойчивый',       'Sustainable development is key.',        'Устойчивое развитие — это ключ.',      6),
    ('waste',        'отходы',           'Reduce food waste at home.',             'Сокращай пищевые отходы дома.',        7),
    ('wildlife',     'дикая природа',    'Protect local wildlife.',                'Защищай местную природу.',             8),
    ('conservation', 'сохранение',       'Wildlife conservation is urgent.',       'Сохранение природы — срочное дело.',   9),
    ('ecosystem',    'экосистема',       'A fragile ecosystem.',                   'Хрупкая экосистема.',                 10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='IELTS' AND c.theme='environment';

-- science_health
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('diagnosis',  'диагноз',           'An early diagnosis saves lives.',     'Ранний диагноз спасает жизни.',          1),
    ('evidence',   'доказательства',    'There is strong evidence.',           'Есть веские доказательства.',            2),
    ('experiment', 'эксперимент',       'They ran an experiment.',             'Они провели эксперимент.',               3),
    ('hypothesis', 'гипотеза',          'Test the hypothesis first.',          'Сначала проверь гипотезу.',              4),
    ('prevention', 'предотвращение',    'Prevention is better than cure.',     'Предотвратить лучше, чем лечить.',       5),
    ('research',   'исследование',      'Medical research is expensive.',      'Медицинские исследования дорогие.',      6),
    ('symptom',    'симптом',           'Fever is a common symptom.',          'Температура — частый симптом.',          7),
    ('treatment',  'лечение',           'A long course of treatment.',         'Длительный курс лечения.',               8),
    ('vaccine',    'вакцина',           'The vaccine is very effective.',      'Вакцина очень эффективна.',              9),
    ('virus',      'вирус',             'A new virus was identified.',         'Был выявлен новый вирус.',              10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='IELTS' AND c.theme='science_health';

-- tech_innovation
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('algorithm',   'алгоритм',           'A smart algorithm.',                  'Умный алгоритм.',                       1),
    ('artificial',  'искусственный',      'Artificial intelligence is growing.', 'Искусственный интеллект развивается.',  2),
    ('automation',  'автоматизация',      'Automation changes jobs.',            'Автоматизация меняет рабочие места.',   3),
    ('device',      'устройство',         'A smart device for the home.',        'Умное устройство для дома.',            4),
    ('digital',     'цифровой',           'A digital economy.',                  'Цифровая экономика.',                   5),
    ('innovation',  'инновация',          'Tech innovation is constant.',        'Технические инновации постоянны.',      6),
    ('intelligence','интеллект',          'Human intelligence vs. AI.',          'Человеческий интеллект против ИИ.',     7),
    ('network',     'сеть',               'A fast 5G network.',                  'Быстрая 5G сеть.',                      8),
    ('security',    'безопасность',       'Online security matters.',            'Безопасность в сети важна.',            9),
    ('software',    'программное обеспечение','Open-source software.',           'Программа с открытым кодом.',          10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='en' AND c.level='IELTS' AND c.theme='tech_innovation';

-- ===== CILS (it) =====

-- verbi_formali
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('analizzare',  'анализировать',  'Analizziamo i dati.',                'Мы анализируем данные.',                     1),
    ('valutare',    'оценивать',      'Dobbiamo valutare la situazione.',   'Нужно оценить ситуацию.',                    2),
    ('dimostrare',  'демонстрировать','Gli studi lo dimostrano.',           'Исследования это демонстрируют.',            3),
    ('stabilire',   'устанавливать',  'Hanno stabilito nuove regole.',      'Они установили новые правила.',              4),
    ('esaminare',   'рассматривать',  'Esaminiamo i risultati.',            'Рассмотрим результаты.',                     5),
    ('evidenziare', 'подчёркивать',   'Il rapporto evidenzia il problema.', 'Отчёт подчёркивает проблему.',               6),
    ('illustrare',  'иллюстрировать', 'Questo caso illustra il punto.',     'Этот случай иллюстрирует мысль.',            7),
    ('implicare',   'подразумевать',  'I dati implicano un trend chiaro.',  'Данные подразумевают чёткий тренд.',         8),
    ('proporre',    'предлагать',     'Gli esperti propongono soluzioni.',  'Эксперты предлагают решения.',               9),
    ('discutere',   'обсуждать',      'Discutiamo il piano.',               'Обсудим план.',                             10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='CILS' AND c.theme='verbi_formali';

-- societa
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('cittadino',     'гражданин',      'Ogni cittadino ha diritti.',          'У каждого гражданина есть права.',      1),
    ('democrazia',    'демократия',     'La democrazia richiede libertà.',     'Демократии нужна свобода.',             2),
    ('uguaglianza',   'равенство',      'Lottano per l''uguaglianza.',         'Они борются за равенство.',             3),
    ('libertà',       'свобода',        'Libertà di parola.',                  'Свобода слова.',                        4),
    ('governo',       'правительство',  'Il governo ha alzato le tasse.',      'Правительство подняло налоги.',         5),
    ('disuguaglianza','неравенство',    'La disuguaglianza cresce.',           'Неравенство растёт.',                   6),
    ('giustizia',     'справедливость', 'Vogliamo giustizia.',                 'Мы хотим справедливости.',              7),
    ('politica',      'политика',       'Una nuova politica economica.',       'Новая экономическая политика.',         8),
    ('protesta',      'протест',        'Una protesta pacifica.',              'Мирный протест.',                       9),
    ('diritto',       'право',          'Il diritto di voto.',                 'Право голоса.',                        10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='CILS' AND c.theme='societa';

-- ambiente
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('clima',         'климат',          'Il clima sta cambiando.',                'Климат меняется.',                  1),
    ('emissione',     'выбросы',         'Ridurre le emissioni di CO2.',           'Сократить выбросы CO2.',            2),
    ('inquinamento',  'загрязнение',     'L''inquinamento dell''aria.',            'Загрязнение воздуха.',              3),
    ('riciclare',     'перерабатывать',  'Ricicliamo la plastica.',                'Мы перерабатываем пластик.',        4),
    ('rinnovabile',   'возобновляемый',  'Energia rinnovabile.',                   'Возобновляемая энергия.',           5),
    ('sostenibile',   'устойчивый',      'Sviluppo sostenibile.',                  'Устойчивое развитие.',              6),
    ('rifiuti',       'отходы',          'Riduciamo i rifiuti.',                   'Сократим отходы.',                  7),
    ('natura',        'природа',         'Proteggi la natura.',                    'Защищай природу.',                  8),
    ('conservazione', 'сохранение',      'Conservazione della fauna.',             'Сохранение фауны.',                 9),
    ('ecosistema',    'экосистема',      'Un ecosistema fragile.',                 'Хрупкая экосистема.',              10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='CILS' AND c.theme='ambiente';

-- salute_scienza
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('diagnosi',     'диагноз',         'Una diagnosi precoce salva vite.',     'Ранний диагноз спасает жизни.',          1),
    ('prova',        'доказательство',  'Ci sono prove solide.',                'Есть веские доказательства.',            2),
    ('esperimento',  'эксперимент',     'Hanno fatto un esperimento.',          'Они провели эксперимент.',               3),
    ('ipotesi',      'гипотеза',        'Verifica prima l''ipotesi.',           'Сначала проверь гипотезу.',              4),
    ('prevenzione',  'предотвращение',  'Meglio la prevenzione della cura.',    'Предотвращение лучше лечения.',          5),
    ('ricerca',      'исследование',    'La ricerca medica è costosa.',         'Медицинское исследование дорогое.',      6),
    ('sintomo',      'симптом',         'La febbre è un sintomo comune.',       'Температура — частый симптом.',          7),
    ('trattamento',  'лечение',         'Un trattamento efficace.',             'Эффективное лечение.',                   8),
    ('vaccino',      'вакцина',         'Il vaccino funziona bene.',            'Вакцина работает хорошо.',               9),
    ('virus',        'вирус',           'Un nuovo virus è stato identificato.', 'Был выявлен новый вирус.',              10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='CILS' AND c.theme='salute_scienza';

-- tecnologia
INSERT INTO public.language_words (course_id, word, translation_ru, example, example_ru, order_index)
SELECT id, w.word, w.tr, w.ex, w.ex_ru, w.ord FROM public.language_courses c,
  (VALUES
    ('algoritmo',     'алгоритм',         'Un algoritmo intelligente.',             'Умный алгоритм.',                      1),
    ('artificiale',   'искусственный',    'Intelligenza artificiale.',              'Искусственный интеллект.',             2),
    ('automazione',   'автоматизация',    'L''automazione cambia il lavoro.',       'Автоматизация меняет работу.',         3),
    ('dispositivo',   'устройство',       'Un dispositivo intelligente.',           'Умное устройство.',                    4),
    ('digitale',      'цифровой',         'Un''economia digitale.',                 'Цифровая экономика.',                  5),
    ('innovazione',   'инновация',        'Innovazione tecnologica costante.',      'Постоянные технические инновации.',    6),
    ('intelligenza',  'интеллект',        'L''intelligenza umana e l''IA.',         'Человеческий интеллект и ИИ.',         7),
    ('rete',          'сеть',             'Una rete veloce 5G.',                    'Быстрая 5G сеть.',                     8),
    ('sicurezza',     'безопасность',     'La sicurezza informatica conta.',        'Кибербезопасность важна.',             9),
    ('software',      'программное обеспечение','Software open source.',            'Программа с открытым кодом.',         10)
  ) AS w(word, tr, ex, ex_ru, ord)
WHERE c.language='it' AND c.level='CILS' AND c.theme='tecnologia';
