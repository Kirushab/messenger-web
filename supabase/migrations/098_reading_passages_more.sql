-- 098_reading_passages_more.sql
-- Фаза 2 (продолжение): больше и длиннее английских текстов (B1–B2) с переводом и вопросами.
-- Только INSERT новых строк.

INSERT INTO public.language_passages (id, language, level, order_index, title_ru, passage, passage_ru, questions) VALUES
(gen_random_uuid(), 'en', 'B1', 53, $title$Смотритель маяка$title$,
$en$For thirty years, Samuel had been the keeper of the lighthouse on Grey Rock. Every evening, just before the sun disappeared into the sea, he climbed the one hundred and twelve steps to the top and lit the great lamp. Ships passing in the dark depended on that light, and Samuel had never once let it go out.

He lived alone, but he did not think of himself as lonely. He had the gulls, the changing colours of the water, and the letters his sister sent twice a year. In the long winter nights, when storms threw waves against the rocks, he would sit by the lamp and read the same old books again and again. He knew every story by heart, yet he never grew tired of them.

One winter, a terrible storm hit the coast. The wind was so strong that it broke windows in the village, and the electricity failed everywhere. In the lighthouse, the modern electric lamp went dark. But Samuel was prepared. He still kept the old oil lamp that his grandfather had used, and he lit it with steady hands. All night the small flame burned, and at dawn a fishing boat reached the harbour safely. The captain later said that without that light, they would surely have hit the rocks.

When journalists came to write about the "hero of Grey Rock," Samuel seemed almost embarrassed. "I only did what I have done every night for thirty years," he said. "The sea does not care about heroes. It only cares whether the light is burning." Then he climbed the stairs again, because evening was coming, and there were ships somewhere out on the dark water.$en$,
$ru$Тридцать лет Сэмюэл был смотрителем маяка на Сером Утёсе. Каждый вечер, прямо перед тем как солнце исчезало в море, он поднимался по ста двенадцати ступеням наверх и зажигал огромную лампу. Корабли, проходящие в темноте, зависели от этого света, и Сэмюэл ни разу не дал ему погаснуть.

Он жил один, но не считал себя одиноким. У него были чайки, меняющиеся цвета воды и письма, которые сестра присылала дважды в год. В долгие зимние ночи, когда штормы бросали волны о скалы, он сидел у лампы и снова и снова перечитывал одни и те же старые книги. Он знал каждую историю наизусть, но они ему не надоедали.

Однажды зимой ужасный шторм обрушился на побережье. Ветер был таким сильным, что выбил окна в деревне, и электричество отключилось повсюду. На маяке современная электрическая лампа погасла. Но Сэмюэл был готов. Он всё ещё хранил старую масляную лампу, которой пользовался его дед, и зажёг её твёрдой рукой. Всю ночь горел маленький огонёк, а на рассвете рыбацкая лодка благополучно дошла до гавани. Капитан позже сказал, что без этого света они наверняка разбились бы о скалы.

Когда приехали журналисты, чтобы написать о «герое Серого Утёса», Сэмюэл выглядел почти смущённым. «Я лишь сделал то, что делаю каждую ночь тридцать лет, — сказал он. — Морю нет дела до героев. Ему важно только, горит ли свет». Потом он снова поднялся по лестнице, потому что приближался вечер, а где-то в тёмной воде были корабли.$ru$,
$json$[
  {"q_ru":"Сколько лет Сэмюэл был смотрителем маяка?","options":["Десять","Двадцать","Тридцать","Сорок"],"correct":2},
  {"q_ru":"Что он делал в долгие зимние ночи?","options":["Ходил в деревню","Перечитывал старые книги","Писал романы","Чинил лодки"],"correct":1},
  {"q_ru":"Что спасло рыбацкую лодку во время шторма?","options":["Современная электрическая лампа","Старая масляная лампа деда","Сигнальная ракета","Свет из деревни"],"correct":1},
  {"q_ru":"Как Сэмюэл отнёсся к вниманию журналистов?","options":["Гордился собой","Был почти смущён","Отказался говорить","Попросил денег"],"correct":1},
  {"q_ru":"Что, по словам Сэмюэла, важно для моря?","options":["Герои","Горит ли свет","Сильные корабли","Хорошая погода"],"correct":1}
]$json$::jsonb),

(gen_random_uuid(), 'en', 'B1', 54, $title$День, когда интернет остановился$title$,
$en$It started on an ordinary Tuesday. At nine in the morning, all over the country, the internet simply stopped. Phones showed no signal, websites would not load, and the little circle on every screen kept spinning forever. At first, people thought it was a problem with their own devices. Then they realised it was happening to everyone.

In the offices, workers stared at their dead computers. Some felt panic; others, secretly, felt relief. In the streets, people looked up from their phones and, for the first time in years, noticed the faces around them. A few began to talk to strangers at bus stops. Children, sent home early from school, played outside until it was dark.

Maria, who worked from home, did not know what to do with herself. For an hour she walked around her flat, picking things up and putting them down. Then she knocked on her neighbour's door — something she had never done in three years of living there. The neighbour, an elderly man, invited her in for tea. They talked for two hours about his life, his late wife, and the city as it used to be.

By evening, the engineers had found the problem and the internet returned. Screens lit up again; messages flooded in. Life went back to normal, or almost. Maria still had her neighbour's phone number, and now they had dinner together every week. Years later, when people remembered "the day the internet stopped," they did not talk about the lost work or the broken systems. They talked, with a strange kind of smile, about the conversations they had had.$en$,
$ru$Всё началось в обычный вторник. В девять утра по всей стране интернет просто остановился. Телефоны не показывали сигнала, сайты не загружались, а маленький кружок на каждом экране бесконечно крутился. Сначала люди думали, что проблема в их собственных устройствах. Потом поняли, что это происходит со всеми.

В офисах работники смотрели на мёртвые компьютеры. Кто-то паниковал; кто-то втайне чувствовал облегчение. На улицах люди подняли глаза от телефонов и впервые за годы заметили лица вокруг. Некоторые начали разговаривать с незнакомцами на остановках. Дети, отпущенные из школы пораньше, играли на улице, пока не стемнело.

Мария, которая работала из дома, не знала, чем себя занять. Целый час она ходила по квартире, что-то брала и клала обратно. Потом постучала в дверь соседа — то, чего ни разу не делала за три года жизни там. Сосед, пожилой мужчина, пригласил её на чай. Они проговорили два часа о его жизни, его покойной жене и о городе, каким он был раньше.

К вечеру инженеры нашли проблему, и интернет вернулся. Экраны снова загорелись; хлынули сообщения. Жизнь вернулась к норме, или почти. У Марии остался номер соседа, и теперь они ужинали вместе каждую неделю. Спустя годы, вспоминая «день, когда интернет остановился», люди говорили не о потерянной работе или сломанных системах. Они говорили, со странной улыбкой, о разговорах, которые тогда состоялись.$ru$,
$json$[
  {"q_ru":"Когда именно остановился интернет?","options":["В воскресенье вечером","В обычный вторник утром","Ночью в пятницу","В праздник"],"correct":1},
  {"q_ru":"Как некоторые люди отреагировали, кроме паники?","options":["Втайне почувствовали облегчение","Сразу уехали из города","Начали ремонт техники","Ничего не заметили"],"correct":0},
  {"q_ru":"Что сделала Мария, чего не делала три года?","options":["Вышла на работу","Постучала к соседу","Позвонила сестре","Купила новый телефон"],"correct":1},
  {"q_ru":"Что изменилось у Марии после этого дня?","options":["Она сменила работу","Они с соседом стали ужинать вместе каждую неделю","Она переехала","Она перестала пользоваться интернетом"],"correct":1},
  {"q_ru":"О чём люди вспоминали спустя годы?","options":["О потерянной работе","О сломанных системах","О состоявшихся разговорах","О панике в офисах"],"correct":2}
]$json$::jsonb),

(gen_random_uuid(), 'en', 'B2', 55, $title$Проводник в горах$title$,
$en$Elena had guided travellers through the mountains for almost twenty years. She knew every path, every dangerous slope, and every place where the weather could change in minutes. Tourists often arrived believing that the mountains were simply a beautiful background for their photographs. Elena's job was to teach them, gently but firmly, that the mountains deserved respect.

One summer, a group of confident young hikers hired her for a three-day trek. From the start, they ignored her advice. They walked too fast, drank their water too quickly, and laughed when she warned them about the clouds gathering in the west. "We are fit," one of them said. "We have done this before." Elena said nothing, but she watched the sky.

On the second afternoon, the storm arrived exactly as she had predicted. Within minutes, the warm sunshine turned into freezing rain and thick fog. The path disappeared. The young hikers, who had been so sure of themselves, suddenly went quiet. Elena, calm as always, gathered them together. She found a sheltered place among the rocks, helped them put on every warm layer they had, and kept them talking so that no one panicked.

They spent a cold, uncomfortable night, but in the morning the sky was clear, and everyone was safe. As they walked down, the leader of the group came to Elena. "I am sorry," he said quietly. "We thought we knew better." Elena smiled. "The mountains are the best teacher I know," she replied. "They are patient, but their lessons are hard. The important thing is that you listened in the end."$en$,
$ru$Елена водила путешественников по горам почти двадцать лет. Она знала каждую тропу, каждый опасный склон и каждое место, где погода могла измениться за минуты. Туристы часто приезжали, считая горы просто красивым фоном для своих фотографий. Работа Елены была в том, чтобы мягко, но твёрдо научить их, что горы заслуживают уважения.

Однажды летом группа уверенных молодых походников наняла её на трёхдневный поход. С самого начала они игнорировали её советы. Шли слишком быстро, слишком быстро выпивали воду и смеялись, когда она предупреждала о тучах, собиравшихся на западе. «Мы в форме, — сказал один из них. — Мы уже делали это раньше». Елена ничего не сказала, но следила за небом.

На второй день, после полудня, шторм пришёл ровно так, как она и предсказывала. За минуты тёплое солнце сменилось ледяным дождём и густым туманом. Тропа исчезла. Молодые походники, ещё недавно такие уверенные, вдруг притихли. Елена, как всегда спокойная, собрала их вместе. Она нашла укрытие среди скал, помогла надеть всю тёплую одежду, что у них была, и поддерживала разговор, чтобы никто не запаниковал.

Они провели холодную, неуютную ночь, но утром небо было ясным, и все были целы. Когда они спускались, лидер группы подошёл к Елене. «Простите, — тихо сказал он. — Мы думали, что знаем лучше». Елена улыбнулась. «Горы — лучший учитель, которого я знаю, — ответила она. — Они терпеливы, но их уроки суровы. Важно, что в конце вы прислушались».$ru$,
$json$[
  {"q_ru":"Сколько лет Елена водила людей по горам?","options":["Около десяти","Около двадцати","Около тридцати","Пять"],"correct":1},
  {"q_ru":"Как вели себя молодые походники в начале?","options":["Слушали каждый совет","Игнорировали её советы","Боялись идти","Хотели вернуться"],"correct":1},
  {"q_ru":"Что произошло на второй день?","options":["Они заблудились в городе","Пришёл шторм, как она предсказывала","Они встретили других туристов","Кто-то получил травму"],"correct":1},
  {"q_ru":"Как Елена не дала группе запаниковать?","options":["Позвонила спасателям","Нашла укрытие и поддерживала разговор","Отправила их вниз одних","Развела большой костёр"],"correct":1},
  {"q_ru":"Какой вывод сделал лидер группы?","options":["Что горы скучны","Что они зря думали, будто знают лучше","Что Елена ошиблась","Что нужно идти быстрее"],"correct":1}
]$json$::jsonb),

(gen_random_uuid(), 'en', 'B1', 56, $title$Маленькая доброта$title$,
$en$James was having one of the worst days of his life. He had lost his job in the morning, missed his train, and spilled coffee on his only good shirt. By the afternoon, walking through the cold city, he felt invisible, as if the whole world had decided he did not matter.

At a busy corner, he saw an old woman trying to carry two heavy bags up a set of stairs. People rushed past her, looking at their phones, in a hurry to be somewhere else. For a moment, James almost walked past too. He was tired, and his own problems felt enormous. But something made him stop.

"Let me help you," he said, and took the bags. The stairs were long, and the woman walked slowly, but she talked the whole way. She told him she was bringing food to her husband in the hospital. She told him that her husband still made her laugh after fifty years of marriage. At the top, she looked at James with bright eyes and said, "You have a kind face. Don't let the world make it hard."

It was such a small thing — a few minutes, two bags of food. But as James walked away, he noticed that the heavy feeling in his chest had lifted a little. His problems were still there, of course. He still had no job, and his shirt was still ruined. Yet he felt, for the first time that day, that he was not invisible after all. Sometimes, he realised, the fastest way to feel better is to help someone else.$en$,
$ru$У Джеймса был один из худших дней в жизни. Утром он потерял работу, опоздал на поезд и пролил кофе на свою единственную хорошую рубашку. К полудню, идя по холодному городу, он чувствовал себя невидимым, будто весь мир решил, что он не важен.

На оживлённом углу он увидел пожилую женщину, пытавшуюся занести две тяжёлые сумки по лестнице. Люди проносились мимо, глядя в телефоны, спеша куда-то ещё. На мгновение Джеймс тоже едва не прошёл мимо. Он устал, и его собственные проблемы казались огромными. Но что-то заставило его остановиться.

«Давайте помогу», — сказал он и взял сумки. Лестница была длинной, женщина шла медленно, но всю дорогу говорила. Она рассказала, что несёт еду мужу в больницу. Рассказала, что муж до сих пор смешит её после пятидесяти лет брака. Наверху она посмотрела на Джеймса яркими глазами и сказала: «У тебя доброе лицо. Не дай миру сделать его жёстким».

Это была такая мелочь — несколько минут, две сумки еды. Но, уходя, Джеймс заметил, что тяжесть в груди немного отпустила. Его проблемы, конечно, никуда не делись. Работы по-прежнему не было, и рубашка была всё так же испорчена. И всё же он впервые за день почувствовал, что всё-таки не невидим. Иногда, понял он, самый быстрый способ почувствовать себя лучше — помочь кому-то другому.$ru$,
$json$[
  {"q_ru":"Почему день Джеймса был ужасным?","options":["Он заболел","Потерял работу, опоздал на поезд, пролил кофе","Поссорился с другом","Потерял телефон"],"correct":1},
  {"q_ru":"Кому женщина несла еду?","options":["Сыну","Мужу в больницу","Соседке","Внукам"],"correct":1},
  {"q_ru":"Что женщина сказала Джеймсу наверху лестницы?","options":["«Спасибо за деньги»","«У тебя доброе лицо»","«Ты опоздаешь»","«Купи новую рубашку»"],"correct":1},
  {"q_ru":"Что почувствовал Джеймс после того, как помог?","options":["Стало ещё тяжелее","Тяжесть немного отпустила","Он разозлился","Ничего не изменилось"],"correct":1},
  {"q_ru":"Какой вывод сделал Джеймс?","options":["Нужно думать только о себе","Помогая другим, быстрее чувствуешь себя лучше","Город слишком холодный","Лучше сидеть дома"],"correct":1}
]$json$::jsonb),

(gen_random_uuid(), 'en', 'B2', 57, $title$Письма в будущее$title$,
$en$Every year, on the last day of school, Mr. Hart gave his students an unusual task. He asked each of them to write a letter to themselves — to the person they would be ten years later. They wrote about their dreams, their fears, and the things they believed would never change. Then they sealed the letters in envelopes, and Mr. Hart promised to keep them safe and send them out a decade later.

For most of the students, the task felt strange, even silly. What could they possibly say to a future they could not imagine? Some wrote only a few lines; others filled several pages. A quiet girl named Sophie wrote that she hoped she would become braver. A boy who loved football wrote that he was certain he would play for a famous team.

Ten years passed. Mr. Hart, now retired, kept his promise. One by one, the letters arrived in the mail. The effect on the former students was powerful. Sophie, now a teacher herself, cried as she read her own handwriting. She had, in fact, become braver — but in ways her younger self could never have predicted. The football boy had not become a famous player, yet he was happy coaching children in his hometown, and he laughed at how sure he had once been.

Many of them wrote back to Mr. Hart to thank him. They said the letters had reminded them of who they once were, and shown them how far they had travelled. "We spend so much time looking forward," one of them wrote, "that we forget to look back and see how much we have grown." Mr. Hart kept every reply in a wooden box, proof that a few honest words, written long ago, could still reach across the years and touch a heart.$en$,
$ru$Каждый год, в последний день учёбы, мистер Харт давал ученикам необычное задание. Он просил каждого написать письмо самому себе — тому человеку, которым он станет через десять лет. Они писали о мечтах, страхах и о том, что, как им казалось, никогда не изменится. Потом запечатывали письма в конверты, и мистер Харт обещал хранить их и отправить через десятилетие.

Большинству учеников задание казалось странным, даже глупым. Что они вообще могли сказать будущему, которое не могли представить? Некоторые писали лишь пару строк; другие исписывали несколько страниц. Тихая девочка по имени Софи написала, что надеется стать смелее. Мальчик, обожавший футбол, написал, что уверен — будет играть за знаменитую команду.

Прошло десять лет. Мистер Харт, теперь на пенсии, сдержал обещание. Одно за другим письма приходили по почте. Эффект на бывших учеников был сильным. Софи, сама ставшая учительницей, плакала, читая собственный почерк. Она действительно стала смелее — но так, как её юная версия не могла бы предсказать. Футбольный мальчик не стал знаменитым игроком, но был счастлив, тренируя детей в родном городе, и смеялся над тем, как когда-то был уверен.

Многие из них написали мистеру Харту, чтобы поблагодарить. Они говорили, что письма напомнили им, кем они были, и показали, как далеко они прошли. «Мы столько времени смотрим вперёд, — написал один из них, — что забываем оглянуться и увидеть, как сильно выросли». Мистер Харт хранил каждый ответ в деревянной коробке — доказательство того, что несколько честных слов, написанных давно, всё ещё могут дотянуться сквозь годы и тронуть сердце.$ru$,
$json$[
  {"q_ru":"Какое задание давал мистер Харт в последний день учёбы?","options":["Написать сочинение о лете","Написать письмо себе через десять лет","Нарисовать мечту","Прочитать книгу"],"correct":1},
  {"q_ru":"Что написала Софи в своём письме?","options":["Что станет знаменитой","Что надеется стать смелее","Что уедет за границу","Что станет врачом"],"correct":1},
  {"q_ru":"Что стало с мальчиком, любившим футбол?","options":["Стал знаменитым игроком","Счастливо тренирует детей в родном городе","Бросил спорт","Стал учителем как Софи"],"correct":1},
  {"q_ru":"Что письма напомнили бывшим ученикам?","options":["О школьных оценках","Кем они были и как далеко прошли","О мистере Харте","О будущих планах"],"correct":1},
  {"q_ru":"Где мистер Харт хранил ответы учеников?","options":["В компьютере","В деревянной коробке","В шкафу школы","Он их не хранил"],"correct":1}
]$json$::jsonb);
