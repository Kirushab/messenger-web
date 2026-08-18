-- 097_reading_passages.sql
-- Фаза 2: большие тексты для чтения (английский, уровень B1) с переводом и вопросами.
-- Безопасно: только INSERT новых строк. id через gen_random_uuid(), questions как jsonb.

INSERT INTO public.language_passages (id, language, level, order_index, title_ru, passage, passage_ru, questions) VALUES
(gen_random_uuid(), 'en', 'B1', 50, $title$Город, который не спит$title$,
$en$When Maria moved to the city, she thought she would never get used to the noise. Back in her village, the loudest sound at night was the wind in the trees. Here, cars passed under her window at every hour, and somewhere far away a siren was always singing.

For the first two weeks she slept badly. She missed the silence, and she missed her family. But slowly, something changed. She began to notice that the noise had a rhythm. In the morning the streets filled with footsteps and quiet conversations. By noon the markets were loud and full of life. Late at night, when most people were asleep, the city became softer, almost gentle.

One evening she met an old man who had lived in the same building for forty years. "The city is like a huge animal," he said with a smile. "It breathes. Once you learn its breathing, you are never alone." Maria laughed, but later she understood what he meant. The sounds that had frightened her at first now felt like company.

A year later, Maria visited her village again. The first night, she could not sleep. It was too quiet. She lay awake, listening to nothing, and found herself missing the song of the city she now called home.$en$,
$ru$Когда Мария переехала в город, она думала, что никогда не привыкнет к шуму. В её деревне самым громким звуком ночью был ветер в деревьях. Здесь машины проезжали под её окном в любой час, и где-то далеко всегда пела сирена.

Первые две недели она плохо спала. Ей не хватало тишины и не хватало семьи. Но постепенно что-то изменилось. Она начала замечать, что у шума есть ритм. Утром улицы наполнялись шагами и тихими разговорами. К полудню рынки были шумными и полными жизни. Поздно ночью, когда большинство людей спали, город становился мягче, почти нежным.

Однажды вечером она встретила старика, который прожил в том же доме сорок лет. «Город — как огромное животное, — сказал он с улыбкой. — Он дышит. Как только научишься его дыханию, ты больше никогда не одинок». Мария засмеялась, но позже поняла, что он имел в виду. Звуки, которые сначала её пугали, теперь казались компанией.

Через год Мария снова приехала в свою деревню. В первую ночь она не могла уснуть. Было слишком тихо. Она лежала без сна, слушая ничего, и поймала себя на том, что скучает по песне города, который теперь называла домом.$ru$,
$json$[
  {"q_ru":"Что было самым громким звуком ночью в деревне Марии?","options":["Машины","Ветер в деревьях","Сирена","Рынок"],"correct":1},
  {"q_ru":"Почему Мария плохо спала первые две недели?","options":["Было слишком жарко","Ей не хватало тишины и семьи","Сосед шумел","Она много работала"],"correct":1},
  {"q_ru":"С чем старик сравнил город?","options":["С огромным животным, которое дышит","С машиной","С рекой","С песней без слов"],"correct":0},
  {"q_ru":"Что случилось, когда Мария вернулась в деревню?","options":["Она сразу уснула","Она не могла уснуть из-за тишины","Она решила остаться там","Деревня изменилась"],"correct":1}
]$json$::jsonb),

(gen_random_uuid(), 'en', 'B1', 51, $title$Старый книжный магазин$title$,
$en$On a narrow street in the old part of town there was a bookshop that almost nobody visited. The window was dusty, and the sign above the door had lost half of its letters. Most people walked past without even looking. But for Tom, that little shop was the best place in the world.

The owner was a quiet woman named Mrs. Ellis. She never tried to sell anything. Instead, she let customers sit in old armchairs and read for hours. "A book should find its reader," she liked to say. "I only keep them safe until then."

Tom went there every Saturday. He was twelve, and he did not have many friends, but he never felt lonely among the shelves. One day Mrs. Ellis gave him a small, worn book with no title on the cover. "This one has been waiting for you," she said. Tom read it in a single weekend. It was a story about a boy who travelled across the sea to find his father, and somehow it felt like it had been written just for him.

Years later, Tom became a writer himself. In the first page of his first novel, he wrote three simple words: "For Mrs. Ellis." The shop was gone by then, but he was sure that, somewhere, a book was still waiting quietly for the right reader.$en$,
$ru$На узкой улице в старой части города был книжный магазин, который почти никто не посещал. Витрина была пыльной, а вывеска над дверью потеряла половину букв. Большинство людей проходили мимо, даже не взглянув. Но для Тома этот маленький магазин был лучшим местом на свете.

Хозяйкой была тихая женщина по имени миссис Эллис. Она никогда не пыталась ничего продать. Вместо этого она позволяла посетителям сидеть в старых креслах и читать часами. «Книга должна найти своего читателя, — любила говорить она. — Я лишь храню их, пока этого не случится».

Том приходил туда каждую субботу. Ему было двенадцать, и у него было мало друзей, но среди полок он никогда не чувствовал себя одиноким. Однажды миссис Эллис дала ему маленькую потрёпанную книгу без названия на обложке. «Эта ждала именно тебя», — сказала она. Том прочитал её за один выходной. Это была история о мальчике, который пересёк море в поисках своего отца, и почему-то она казалась написанной специально для него.

Спустя годы Том сам стал писателем. На первой странице своего первого романа он написал три простых слова: «Миссис Эллис». Магазина к тому времени уже не было, но он был уверен, что где-то книга всё ещё тихо ждёт нужного читателя.$ru$,
$json$[
  {"q_ru":"Как выглядел книжный магазин снаружи?","options":["Новый и яркий","Пыльная витрина и вывеска без половины букв","Большой и современный","Закрытый навсегда"],"correct":1},
  {"q_ru":"Что миссис Эллис разрешала делать посетителям?","options":["Брать книги бесплатно","Сидеть и читать часами","Работать в магазине","Продавать свои книги"],"correct":1},
  {"q_ru":"О чём была книга, которую она дала Тому?","options":["О городе, который не спит","О мальчике, ищущем отца за морем","О старом магазине","О писателе"],"correct":1},
  {"q_ru":"Что Том написал на первой странице своего романа?","options":["Название города","«Миссис Эллис»","Своё имя","Благодарность семье"],"correct":1},
  {"q_ru":"Кем стал Том спустя годы?","options":["Продавцом книг","Писателем","Моряком","Учителем"],"correct":1}
]$json$::jsonb),

(gen_random_uuid(), 'en', 'B1', 52, $title$Письмо путешественника$title$,
$en$Dear Anna,

I am writing to you from a small town high in the mountains, where the air is so clear that the stars seem close enough to touch. I have been travelling for three months now, and I have learned more about myself than in all my years at home.

At first, I was afraid of almost everything: of getting lost, of speaking the wrong words, of being alone in places where no one knew my name. But fear, I discovered, becomes smaller every time you decide to act anyway. Last week I climbed a hill at sunrise with people I had met only the day before. None of us spoke the same language well, yet we understood each other perfectly.

I have also learned that kindness exists everywhere. A woman who sold bread gave me an extra loaf when she saw I was tired. A boy showed me the way to the station and refused to take any money. These small moments matter more than any famous building or beautiful view.

I do not know yet when I will come home. Part of me wants to keep going forever. But another part misses ordinary things: our long talks, the coffee we used to drink, the sound of your laugh. Perhaps that is the real lesson of travelling. It teaches you, finally, what home truly means.

With love,
Daniel$en$,
$ru$Дорогая Анна,

Пишу тебе из маленького городка высоко в горах, где воздух такой чистый, что звёзды кажутся настолько близкими, что их можно коснуться. Я путешествую уже три месяца и узнал о себе больше, чем за все годы дома.

Сначала я боялся почти всего: заблудиться, сказать не те слова, остаться одному там, где никто не знает моего имени. Но страх, как я обнаружил, становится меньше каждый раз, когда ты всё равно решаешь действовать. На прошлой неделе я поднялся на холм на рассвете с людьми, которых встретил лишь накануне. Никто из нас не говорил хорошо на одном языке, и всё же мы прекрасно понимали друг друга.

Ещё я понял, что доброта существует везде. Женщина, продававшая хлеб, дала мне лишнюю буханку, увидев, что я устал. Мальчик показал мне дорогу к станции и отказался брать деньги. Эти маленькие моменты значат больше, чем любое знаменитое здание или красивый вид.

Я пока не знаю, когда вернусь домой. Часть меня хочет идти дальше вечно. Но другая часть скучает по обычным вещам: нашим долгим разговорам, кофе, который мы пили, звуку твоего смеха. Возможно, это и есть настоящий урок путешествий. Он наконец учит тебя тому, что на самом деле значит дом.

С любовью,
Дэниел$ru$,
$json$[
  {"q_ru":"Откуда Дэниел пишет письмо?","options":["С берега моря","Из маленького городка в горах","Из большого города","Из деревни Анны"],"correct":1},
  {"q_ru":"Что, по словам Дэниела, происходит со страхом?","options":["Он растёт со временем","Он становится меньше, когда всё равно действуешь","Он исчезает сразу","Он не меняется"],"correct":1},
  {"q_ru":"Какие моменты он считает самыми важными?","options":["Знаменитые здания","Красивые виды","Маленькие проявления доброты","Дорогие сувениры"],"correct":2},
  {"q_ru":"Чему, по его мнению, на самом деле учат путешествия?","options":["Тому, что значит дом","Иностранным языкам","Как экономить деньги","Как не бояться высоты"],"correct":0}
]$json$::jsonb);
