-- ============================================================
-- 160_reading_a1_es_de_fr.sql
-- Бэклог по языкам #5: лёгкие тексты для чтения A1 (es/de/fr), по 3 на язык.
-- Темы: семья / распорядок дня / парк. Простой present, базовая лексика.
-- Идемпотентно: ON CONFLICT (language, level, order_index) DO UPDATE.
-- Dollar-quoting ($P$/$R$/$Q$) — апострофы во французском/испанском без экранирования.
-- ============================================================

ALTER TABLE public.language_passages DROP CONSTRAINT IF EXISTS language_passages_language_check;
ALTER TABLE public.language_passages ADD  CONSTRAINT language_passages_language_check CHECK (language IN ('en','it','es','de','fr'));

INSERT INTO public.language_passages (id, language, level, order_index, title_ru, topic_emoji, passage, passage_ru, questions) VALUES

-- ===== ES A1 =====
(gen_random_uuid(), 'es', 'A1', 1, 'Mi familia', '👨‍👩‍👧',
 $P$Me llamo Sofía. Tengo una familia pequeña. Mi madre se llama Carmen y mi padre se llama Juan. Tengo un hermano. Se llama Pablo. Tenemos un perro. El perro es grande y se llama Max. Vivimos en una casa en Madrid.$P$,
 $R$Меня зовут София. У меня небольшая семья. Мою маму зовут Кармен, а папу — Хуан. У меня есть брат. Его зовут Пабло. У нас есть собака. Собака большая, её зовут Макс. Мы живём в доме в Мадриде.$R$,
 $Q$[{"q_ru": "Как зовут маму Софии?", "options": ["Кармен", "Ана", "Эмма"], "correct": 0}, {"q_ru": "Сколько братьев у Софии?", "options": ["Один", "Два", "Ни одного"], "correct": 0}, {"q_ru": "Где они живут?", "options": ["В Мадриде", "В Барселоне", "В Париже"], "correct": 0}]$Q$),

(gen_random_uuid(), 'es', 'A1', 2, 'Mi día', '☀️',
 $P$Por la mañana me levanto a las siete. Desayuno café con pan. Voy al trabajo en autobús. A la una como con mis amigos. Por la tarde estudio español. Por la noche ceno en casa y veo la televisión. A las once me voy a dormir.$P$,
 $R$Утром я встаю в семь. На завтрак — кофе с хлебом. Я еду на работу на автобусе. В час обедаю с друзьями. Днём учу испанский. Вечером ужинаю дома и смотрю телевизор. В одиннадцать иду спать.$R$,
 $Q$[{"q_ru": "Во сколько она встаёт?", "options": ["В семь", "В восемь", "В шесть"], "correct": 0}, {"q_ru": "Как она едет на работу?", "options": ["На автобусе", "На метро", "Пешком"], "correct": 0}, {"q_ru": "Что она делает вечером?", "options": ["Ужинает и смотрит ТВ", "Работает", "Гуляет"], "correct": 0}]$Q$),

(gen_random_uuid(), 'es', 'A1', 3, 'En el parque', '🌳',
 $P$Hoy hace buen tiempo. Voy al parque con mi amiga Ana. En el parque hay muchos árboles y flores. Comemos un helado. Ana lee un libro y yo escucho música. Por la tarde, empieza a llover y volvemos a casa.$P$,
 $R$Сегодня хорошая погода. Я иду в парк с подругой Аной. В парке много деревьев и цветов. Мы едим мороженое. Ана читает книгу, а я слушаю музыку. Днём начинается дождь, и мы возвращаемся домой.$R$,
 $Q$[{"q_ru": "С кем она идёт в парк?", "options": ["С Аной", "С Пабло", "Одна"], "correct": 0}, {"q_ru": "Что они едят?", "options": ["Мороженое", "Пиццу", "Хлеб"], "correct": 0}, {"q_ru": "Почему они возвращаются домой?", "options": ["Начинается дождь", "Устали", "Поздно"], "correct": 0}]$Q$),

-- ===== FR A1 =====
(gen_random_uuid(), 'fr', 'A1', 1, 'Ma famille', '👨‍👩‍👧',
 $P$Je m'appelle Léa. J'ai une petite famille. Ma mère s'appelle Marie et mon père s'appelle Paul. J'ai une sœur. Elle s'appelle Emma. Nous avons un chat. Le chat est noir et s'appelle Minou. Nous habitons à Lyon.$P$,
 $R$Меня зовут Леа. У меня небольшая семья. Мою маму зовут Мари, а папу — Поль. У меня есть сестра. Её зовут Эмма. У нас есть кот. Кот чёрный, его зовут Мину. Мы живём в Лионе.$R$,
 $Q$[{"q_ru": "Как зовут маму Леа?", "options": ["Мари", "Эмма", "Анна"], "correct": 0}, {"q_ru": "Сколько сестёр у Леа?", "options": ["Одна", "Две", "Ни одной"], "correct": 0}, {"q_ru": "Где они живут?", "options": ["В Лионе", "В Париже", "В Ницце"], "correct": 0}]$Q$),

(gen_random_uuid(), 'fr', 'A1', 2, 'Ma journée', '☀️',
 $P$Le matin, je me lève à sept heures. Je prends un café et du pain. Je vais au travail en métro. À midi, je mange avec mes amis. L'après-midi, j'étudie le français. Le soir, je dîne à la maison et je regarde la télévision. À onze heures, je vais dormir.$P$,
 $R$Утром я встаю в семь часов. Я беру кофе и хлеб. Я еду на работу на метро. В полдень обедаю с друзьями. Днём учу французский. Вечером ужинаю дома и смотрю телевизор. В одиннадцать иду спать.$R$,
 $Q$[{"q_ru": "Во сколько она встаёт?", "options": ["В семь часов", "В восемь", "В шесть"], "correct": 0}, {"q_ru": "Как она едет на работу?", "options": ["На метро", "На автобусе", "На машине"], "correct": 0}, {"q_ru": "Что она делает вечером?", "options": ["Ужинает и смотрит ТВ", "Учится", "Спит"], "correct": 0}]$Q$),

(gen_random_uuid(), 'fr', 'A1', 3, 'Au parc', '🌳',
 $P$Aujourd'hui, il fait beau. Je vais au parc avec mon amie Claire. Dans le parc, il y a beaucoup d'arbres et de fleurs. Nous mangeons une glace. Claire lit un livre et j'écoute de la musique. L'après-midi, il commence à pleuvoir et nous rentrons à la maison.$P$,
 $R$Сегодня хорошая погода. Я иду в парк с подругой Клер. В парке много деревьев и цветов. Мы едим мороженое. Клер читает книгу, а я слушаю музыку. Днём начинается дождь, и мы возвращаемся домой.$R$,
 $Q$[{"q_ru": "С кем она идёт в парк?", "options": ["С Клер", "С Эммой", "Одна"], "correct": 0}, {"q_ru": "Что они едят?", "options": ["Мороженое", "Торт", "Фрукты"], "correct": 0}, {"q_ru": "Почему они возвращаются домой?", "options": ["Идёт дождь", "Поздно", "Голодны"], "correct": 0}]$Q$),

-- ===== DE A1 =====
(gen_random_uuid(), 'de', 'A1', 1, 'Meine Familie', '👨‍👩‍👧',
 $P$Ich heiße Lena. Ich habe eine kleine Familie. Meine Mutter heißt Anna und mein Vater heißt Peter. Ich habe einen Bruder. Er heißt Max. Wir haben einen Hund. Der Hund ist groß und heißt Rex. Wir wohnen in Berlin.$P$,
 $R$Меня зовут Лена. У меня небольшая семья. Мою маму зовут Анна, а папу — Петер. У меня есть брат. Его зовут Макс. У нас есть собака. Собака большая, её зовут Рекс. Мы живём в Берлине.$R$,
 $Q$[{"q_ru": "Как зовут маму Лены?", "options": ["Анна", "Мария", "Лена"], "correct": 0}, {"q_ru": "Сколько братьев у Лены?", "options": ["Один", "Два", "Ни одного"], "correct": 0}, {"q_ru": "Где они живут?", "options": ["В Берлине", "В Мюнхене", "В Гамбурге"], "correct": 0}]$Q$),

(gen_random_uuid(), 'de', 'A1', 2, 'Mein Tag', '☀️',
 $P$Am Morgen stehe ich um sieben Uhr auf. Ich frühstücke Kaffee und Brot. Ich fahre mit dem Bus zur Arbeit. Um eins esse ich mit meinen Freunden. Am Nachmittag lerne ich Deutsch. Am Abend esse ich zu Hause und sehe fern. Um elf Uhr gehe ich schlafen.$P$,
 $R$Утром я встаю в семь часов. Я завтракаю кофе с хлебом. Я еду на работу на автобусе. В час обедаю с друзьями. Днём учу немецкий. Вечером ем дома и смотрю телевизор. В одиннадцать иду спать.$R$,
 $Q$[{"q_ru": "Во сколько она встаёт?", "options": ["В семь часов", "В восемь", "В шесть"], "correct": 0}, {"q_ru": "Как она едет на работу?", "options": ["На автобусе", "На метро", "Пешком"], "correct": 0}, {"q_ru": "Что она делает вечером?", "options": ["Ест и смотрит ТВ", "Работает", "Гуляет"], "correct": 0}]$Q$),

(gen_random_uuid(), 'de', 'A1', 3, 'Im Park', '🌳',
 $P$Heute ist das Wetter schön. Ich gehe mit meiner Freundin Mia in den Park. Im Park gibt es viele Bäume und Blumen. Wir essen ein Eis. Mia liest ein Buch und ich höre Musik. Am Nachmittag beginnt es zu regnen und wir gehen nach Hause.$P$,
 $R$Сегодня хорошая погода. Я иду в парк с подругой Мией. В парке много деревьев и цветов. Мы едим мороженое. Мия читает книгу, а я слушаю музыку. Днём начинается дождь, и мы идём домой.$R$,
 $Q$[{"q_ru": "С кем она идёт в парк?", "options": ["С Мией", "С Максом", "Одна"], "correct": 0}, {"q_ru": "Что они едят?", "options": ["Мороженое", "Пиццу", "Хлеб"], "correct": 0}, {"q_ru": "Почему они идут домой?", "options": ["Идёт дождь", "Устали", "Поздно"], "correct": 0}]$Q$)

ON CONFLICT (language, level, order_index) DO UPDATE SET
  title_ru=EXCLUDED.title_ru, topic_emoji=EXCLUDED.topic_emoji,
  passage=EXCLUDED.passage, passage_ru=EXCLUDED.passage_ru, questions=EXCLUDED.questions;
