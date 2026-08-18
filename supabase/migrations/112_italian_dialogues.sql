-- 112_italian_dialogues.sql
-- Итальянские диалоги (разговорная практика) как тексты для чтения. Уровни A1/A2/B1.

INSERT INTO public.language_passages (id, language, level, order_index, title_ru, topic_emoji, passage, passage_ru, questions) VALUES
(gen_random_uuid(), 'it', 'A1', 3, 'Диалог: в баре', '☕',
$it$— Buongiorno! Mi dica.
— Buongiorno. Vorrei un caffè, per favore.
— Subito. Qualcos'altro?
— Sì, anche un cornetto.
— Va bene. Al banco o al tavolo?
— Al banco, grazie. Quanto costa?
— Due euro e cinquanta.
— Ecco a lei.
— Grazie e buona giornata!$it$,
$ru$— Доброе утро! Слушаю вас.
— Доброе утро. Я бы хотел кофе, пожалуйста.
— Сейчас. Что-нибудь ещё?
— Да, ещё круассан.
— Хорошо. У стойки или за столиком?
— У стойки, спасибо. Сколько стоит?
— Два евро пятьдесят.
— Вот, пожалуйста.
— Спасибо и хорошего дня!$ru$,
$j$[
  {"q_ru":"Что заказал клиент?","options":["Чай и торт","Кофе и круассан","Воду","Сок"],"correct":1},
  {"q_ru":"Где он будет есть?","options":["За столиком","У стойки","На улице","Дома"],"correct":1},
  {"q_ru":"Сколько стоит?","options":["2,50 €","5 €","3 €","10 €"],"correct":0}
]$j$::jsonb),

(gen_random_uuid(), 'it', 'A2', 3, 'Диалог: спросить дорогу', '🧭',
$it$— Scusi, mi sa dire dov'è la stazione?
— Certo. Vada dritto fino al semaforo, poi giri a destra.
— È lontano?
— No, sono circa cinque minuti a piedi.
— C'è una farmacia qui vicino?
— Sì, ce n'è una accanto alla stazione.
— Grazie mille!
— Prego, buona giornata.$it$,
$ru$— Извините, вы не подскажете, где вокзал?
— Конечно. Идите прямо до светофора, потом поверните направо.
— Это далеко?
— Нет, примерно пять минут пешком.
— Есть ли поблизости аптека?
— Да, одна есть рядом с вокзалом.
— Большое спасибо!
— Пожалуйста, хорошего дня.$ru$,
$j$[
  {"q_ru":"Что ищет человек?","options":["Аптеку","Вокзал","Музей","Отель"],"correct":1},
  {"q_ru":"Куда повернуть у светофора?","options":["Налево","Направо","Назад","Прямо"],"correct":1},
  {"q_ru":"Сколько идти пешком?","options":["5 минут","15 минут","30 минут","1 час"],"correct":0},
  {"q_ru":"Где находится аптека?","options":["Рядом с вокзалом","У светофора","В центре","Не сказано"],"correct":0}
]$j$::jsonb),

(gen_random_uuid(), 'it', 'A2', 4, 'Диалог: покупки', '🛒',
$it$— Buonasera, desidera?
— Vorrei un chilo di mele, per favore.
— Ecco. Altro?
— Sì, mezzo chilo di pomodori e del pane.
— Abbiamo del pane fresco. Quanto ne vuole?
— Due, grazie. Quant'è in tutto?
— Sono otto euro.
— Posso pagare con la carta?
— Certo, prego.$it$,
$ru$— Добрый вечер, что желаете?
— Я бы хотел килограмм яблок, пожалуйста.
— Вот. Ещё что-нибудь?
— Да, полкило помидоров и хлеба.
— У нас есть свежий хлеб. Сколько вам?
— Две штуки, спасибо. Сколько всего?
— Восемь евро.
— Можно заплатить картой?
— Конечно, пожалуйста.$ru$,
$j$[
  {"q_ru":"Сколько яблок просит покупатель?","options":["Полкило","Килограмм","Два килограмма","Одно"],"correct":1},
  {"q_ru":"Чем хочет заплатить?","options":["Наличными","Картой","Не сказано","Чеком"],"correct":1},
  {"q_ru":"Сколько всего к оплате?","options":["8 евро","5 евро","12 евро","2 евро"],"correct":0}
]$j$::jsonb),

(gen_random_uuid(), 'it', 'B1', 2, 'Диалог: собеседование', '💼',
$it$— Buongiorno, si accomodi. Mi parli un po' di lei.
— Buongiorno. Mi chiamo Luca, ho ventotto anni e lavoro nel marketing da quattro anni.
— Perché vuole lavorare con noi?
— Perché la vostra azienda è leader nel settore e vorrei crescere professionalmente.
— Quali sono i suoi punti di forza?
— Sono organizzato, lavoro bene in gruppo e imparo in fretta.
— Bene. Quando potrebbe iniziare?
— Sarei disponibile dal mese prossimo.
— Perfetto, la richiameremo presto.$it$,
$ru$— Здравствуйте, присаживайтесь. Расскажите немного о себе.
— Здравствуйте. Меня зовут Лука, мне двадцать восемь лет, и я работаю в маркетинге четыре года.
— Почему вы хотите работать у нас?
— Потому что ваша компания — лидер в отрасли, и я хотел бы расти профессионально.
— Каковы ваши сильные стороны?
— Я организован, хорошо работаю в команде и быстро учусь.
— Хорошо. Когда вы могли бы начать?
— Я был бы свободен со следующего месяца.
— Отлично, мы вам скоро перезвоним.$ru$,
$j$[
  {"q_ru":"Кем работает Лука?","options":["В маркетинге","Врачом","Учителем","Инженером"],"correct":0},
  {"q_ru":"Сколько у него лет опыта?","options":["Два","Четыре","Шесть","Десять"],"correct":1},
  {"q_ru":"Почему он хочет эту работу?","options":["Близко к дому","Компания — лидер, хочет расти","Высокая зарплата","Друзья там работают"],"correct":1},
  {"q_ru":"Когда он может начать?","options":["Завтра","Со следующего месяца","Через год","Сразу"],"correct":1}
]$j$::jsonb);
