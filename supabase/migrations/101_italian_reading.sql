-- 101_italian_reading.sql
-- Итальянские тексты для чтения с градацией по уровням (A1, A2, B1).
-- Таблица language_passages уже существует (069). Уровни A1/A2/B1 не конфликтуют с CILS.

INSERT INTO public.language_passages (id, language, level, order_index, title_ru, topic_emoji, passage, passage_ru, questions) VALUES
(gen_random_uuid(), 'it', 'A1', 1, 'Мой день', '☀️',
$it$Mi chiamo Anna. Ogni mattina mi sveglio alle sette. Faccio colazione con caffè e pane. Poi vado al lavoro in autobus. Lavoro in un ufficio in centro. A mezzogiorno mangio un panino con i colleghi. La sera torno a casa e cucino la cena. Dopo cena guardo la televisione o leggo un libro. Vado a dormire alle undici. Mi piace molto la mia giornata tranquilla.$it$,
$ru$Меня зовут Анна. Каждое утро я просыпаюсь в семь. Завтракаю кофе с хлебом. Потом еду на работу на автобусе. Я работаю в офисе в центре. В полдень ем сэндвич с коллегами. Вечером возвращаюсь домой и готовлю ужин. После ужина смотрю телевизор или читаю книгу. Ложусь спать в одиннадцать. Мне очень нравится мой спокойный день.$ru$,
$j$[
  {"q_ru":"Во сколько Анна просыпается?","options":["В шесть","В семь","В восемь","В девять"],"correct":1},
  {"q_ru":"Как она добирается до работы?","options":["Пешком","На метро","На автобусе","На машине"],"correct":2},
  {"q_ru":"Что Анна делает после ужина?","options":["Сразу спит","Смотрит ТВ или читает","Идёт на работу","Готовит завтрак"],"correct":1}
]$j$::jsonb),

(gen_random_uuid(), 'it', 'A1', 2, 'Семья Марко', '👨‍👩‍👧‍👦',
$it$Marco ha una famiglia grande. Suo padre si chiama Luigi e fa il medico. Sua madre si chiama Carla e fa l'insegnante. Marco ha due sorelle e un fratello. Le sorelle si chiamano Sara e Giulia. Il fratello più piccolo si chiama Paolo. Hanno anche un cane, Fido. La domenica la famiglia mangia insieme dalla nonna. La nonna prepara sempre la pasta. Marco ama molto la sua famiglia.$it$,
$ru$У Марко большая семья. Его отца зовут Луиджи, он врач. Его маму зовут Карла, она учительница. У Марко две сестры и брат. Сестёр зовут Сара и Джулия. Младшего брата зовут Паоло. У них также есть собака, Фидо. По воскресеньям семья ест вместе у бабушки. Бабушка всегда готовит пасту. Марко очень любит свою семью.$ru$,
$j$[
  {"q_ru":"Кем работает отец Марко?","options":["Учитель","Врач","Повар","Водитель"],"correct":1},
  {"q_ru":"Сколько у Марко сестёр?","options":["Одна","Две","Три","Ни одной"],"correct":1},
  {"q_ru":"Что бабушка всегда готовит по воскресеньям?","options":["Пиццу","Пасту","Суп","Рыбу"],"correct":1}
]$j$::jsonb),

(gen_random_uuid(), 'it', 'A2', 1, 'День в Риме', '🏛️',
$it$Sabato scorso ho visitato Roma con i miei amici. Siamo arrivati la mattina presto in treno. Prima abbiamo visto il Colosseo, che è enorme e molto antico. Poi siamo andati alla Fontana di Trevi e abbiamo lanciato una moneta nell'acqua. A pranzo abbiamo mangiato la pasta in un piccolo ristorante vicino al centro. Il pomeriggio abbiamo camminato per le strade strette e abbiamo comprato dei souvenir. Faceva caldo, ma eravamo molto contenti. La sera siamo tornati a casa stanchi ma felici. Roma è una città bellissima e voglio tornarci presto.$it$,
$ru$В прошлую субботу я посетил Рим с друзьями. Мы приехали рано утром на поезде. Сначала мы увидели Колизей, огромный и очень древний. Потом пошли к фонтану Треви и бросили монету в воду. На обед мы ели пасту в маленьком ресторане недалеко от центра. Днём мы гуляли по узким улицам и купили сувениры. Было жарко, но мы были очень довольны. Вечером вернулись домой уставшие, но счастливые. Рим — красивейший город, и я хочу скоро туда вернуться.$ru$,
$j$[
  {"q_ru":"Как друзья приехали в Рим?","options":["На самолёте","На поезде","На машине","На автобусе"],"correct":1},
  {"q_ru":"Что они сделали у фонтана Треви?","options":["Пообедали","Бросили монету","Купили сувениры","Сфотографировались"],"correct":1},
  {"q_ru":"Что они ели на обед?","options":["Пиццу","Пасту","Сэндвич","Мороженое"],"correct":1},
  {"q_ru":"Какими они вернулись домой вечером?","options":["Грустными","Уставшими, но счастливыми","Злыми","Голодными"],"correct":1}
]$j$::jsonb),

(gen_random_uuid(), 'it', 'A2', 2, 'В ресторане', '🍽️',
$it$Ieri sera io e Marta siamo andati al ristorante per festeggiare il suo compleanno. Il cameriere ci ha portato il menù e abbiamo ordinato subito. Marta ha scelto il pesce con le verdure, mentre io ho preso una pizza margherita. Come bevanda abbiamo ordinato dell'acqua e un bicchiere di vino rosso. Il cibo era delizioso e il servizio molto gentile. Alla fine, il cameriere ci ha portato un dolce gratis con una candela per Marta. Abbiamo pagato il conto e abbiamo lasciato una mancia. È stata una bella serata.$it$,
$ru$Вчера вечером мы с Мартой пошли в ресторан, чтобы отпраздновать её день рождения. Официант принёс нам меню, и мы сразу сделали заказ. Марта выбрала рыбу с овощами, а я взял пиццу «Маргарита». Из напитков мы заказали воду и бокал красного вина. Еда была восхитительной, а обслуживание очень вежливым. В конце официант принёс бесплатный десерт со свечкой для Марты. Мы оплатили счёт и оставили чаевые. Это был прекрасный вечер.$ru$,
$j$[
  {"q_ru":"По какому поводу они пошли в ресторан?","options":["День рождения Марты","Свадьба","Новый год","Просто так"],"correct":0},
  {"q_ru":"Что заказала Марта?","options":["Пиццу","Рыбу с овощами","Пасту","Суп"],"correct":1},
  {"q_ru":"Что официант принёс в конце?","options":["Сразу счёт","Бесплатный десерт со свечкой","Кофе","Цветы"],"correct":1}
]$j$::jsonb),

(gen_random_uuid(), 'it', 'B1', 1, 'Первый день на работе', '💼',
$it$Lunedì è stato il mio primo giorno di lavoro in una nuova azienda. Ero molto nervoso, così sono arrivato in ufficio con venti minuti di anticipo. La mia nuova capa, la signora Bianchi, mi ha accolto con un sorriso e mi ha presentato ai colleghi. All'inizio non ricordavo i nomi di tutti e mi sentivo un po' confuso. Durante la mattina ho imparato a usare i programmi del computer e ho letto molti documenti. A pranzo, due colleghi mi hanno invitato a mangiare con loro e abbiamo parlato dei nostri interessi. Il pomeriggio è passato velocemente perché avevo molte cose da fare. Alla fine della giornata ero stanco, ma anche soddisfatto. Ho capito che il lavoro sarà impegnativo, però l'ambiente è amichevole. Tornando a casa, ho pensato che avevo fatto la scelta giusta.$it$,
$ru$Понедельник был моим первым днём работы в новой компании. Я очень нервничал, поэтому пришёл в офис на двадцать минут раньше. Моя новая начальница, синьора Бьянки, встретила меня с улыбкой и представила коллегам. Сначала я не помнил имена всех и чувствовал себя немного растерянным. Утром я научился пользоваться компьютерными программами и прочитал много документов. На обед двое коллег пригласили меня поесть с ними, и мы поговорили о наших интересах. Вторая половина дня прошла быстро, потому что у меня было много дел. К концу дня я устал, но был доволен. Я понял, что работа будет напряжённой, но коллектив дружелюбный. Возвращаясь домой, я подумал, что сделал правильный выбор.$ru$,
$j$[
  {"q_ru":"Почему рассказчик пришёл раньше?","options":["Любит ходить пешком","Очень нервничал","Опоздал автобус","Была встреча"],"correct":1},
  {"q_ru":"Кто такая синьора Бьянки?","options":["Коллега","Его начальница","Соседка","Клиент"],"correct":1},
  {"q_ru":"Что он делал утром?","options":["Обедал с коллегами","Учился пользоваться программами и читал документы","Гулял по городу","Отдыхал"],"correct":1},
  {"q_ru":"Какой вывод он сделал по дороге домой?","options":["Сделал неправильный выбор","Сделал правильный выбор","Хочет уволиться","Работа скучная"],"correct":1}
]$j$::jsonb);
