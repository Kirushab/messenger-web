-- 118_grammar_en.sql
-- Грамматика английского. Виды переиспользуются из общего движка:
-- conjugation=Present Simple, past=Past Simple, futuro=Future(will), article, plural, comparative, modal.

DELETE FROM public.grammar_items WHERE language='en';

-- ===== PRESENT SIMPLE (to be / to have / -s) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('en','conjugation','A1','be',1,'I ___ (to be)','я (быть)','am',$j$["am","is","are","be"]$j$,'to be: I am; you/we/they are; he/she/it is'),
('en','conjugation','A1','be',2,'You ___ (to be)','ты/вы (быть)','are',$j$["am","is","are","be"]$j$,'to be: you are'),
('en','conjugation','A1','be',3,'He ___ (to be)','он (быть)','is',$j$["am","is","are","be"]$j$,'to be: he is'),
('en','conjugation','A1','be',4,'We ___ (to be)','мы (быть)','are',$j$["am","is","are","be"]$j$,'to be: we are'),
('en','conjugation','A1','be',5,'They ___ (to be)','они (быть)','are',$j$["am","is","are","be"]$j$,'to be: they are'),
('en','conjugation','A1','be',6,'She ___ (to be)','она (быть)','is',$j$["am","is","are","be"]$j$,'to be: she is'),
('en','conjugation','A1','have',7,'I ___ a car. (to have)','у меня есть машина','have',$j$["have","has","haves","having"]$j$,'have; 3-е лицо ед. → has'),
('en','conjugation','A1','have',8,'She ___ a car. (to have)','у неё есть машина','has',$j$["have","has","haves","having"]$j$,'she/he/it → has'),
('en','conjugation','A1','have',9,'They ___ a car. (to have)','у них есть машина','have',$j$["have","has","haves","having"]$j$,'they → have'),
('en','conjugation','A1','present',10,'He ___ every day. (work)','он работает каждый день','works',$j$["work","works","working","worked"]$j$,'3-е лицо ед.: + s'),
('en','conjugation','A1','present',11,'I ___ to school. (go)','я хожу в школу','go',$j$["go","goes","going","went"]$j$,'I/you/we/they — базовая форма'),
('en','conjugation','A1','present',12,'She ___ coffee. (like)','она любит кофе','likes',$j$["like","likes","liking","liked"]$j$,'3-е лицо ед.: likes');

-- ===== PAST SIMPLE (неправильные глаголы) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('en','past','A2','pst',1,'Yesterday I ___ home. (go)','вчера я пошёл домой','went',$j$["went","goed","gone","go"]$j$,'go → went'),
('en','past','A2','pst',2,'She ___ a cake. (make)','она сделала торт','made',$j$["made","maked","make","making"]$j$,'make → made'),
('en','past','A2','pst',3,'We ___ a film. (see)','мы посмотрели фильм','saw',$j$["saw","seen","seed","see"]$j$,'see → saw'),
('en','past','A2','pst',4,'He ___ breakfast. (eat)','он съел завтрак','ate',$j$["ate","eated","eaten","eat"]$j$,'eat → ate'),
('en','past','A2','pst',5,'I ___ a letter. (write)','я написал письмо','wrote',$j$["wrote","writed","written","write"]$j$,'write → wrote'),
('en','past','A2','pst',6,'They ___ home late. (come)','они пришли поздно','came',$j$["came","comed","come","coming"]$j$,'come → came'),
('en','past','A2','pst',7,'She ___ me a gift. (give)','она дала мне подарок','gave',$j$["gave","gived","given","give"]$j$,'give → gave'),
('en','past','A2','pst',8,'I ___ a new phone. (get)','я получил новый телефон','got',$j$["got","getted","gotten","get"]$j$,'get → got'),
('en','past','A2','pst',9,'He ___ his homework. (do)','он сделал домашнее задание','did',$j$["did","done","doed","do"]$j$,'do → did'),
('en','past','A2','pst',10,'She ___ hello. (say)','она сказала привет','said',$j$["said","sayed","say","saying"]$j$,'say → said'),
('en','past','A2','pst',11,'I ___ tired. (be)','я был уставшим','was',$j$["was","were","been","am"]$j$,'be → was (I/he/she/it)'),
('en','past','A2','pst',12,'They ___ at home. (be)','они были дома','were',$j$["were","was","been","are"]$j$,'be → were (you/we/they)');

-- ===== FUTURE (will) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('en','futuro','A2','wll',1,'Tomorrow I ___ you. (call)','завтра я позвоню тебе','will call',$j$["will call","will called","will calling","call"]$j$,'Future: will + базовая форма'),
('en','futuro','A2','wll',2,'She ___ a doctor. (be)','она станет врачом','will be',$j$["will be","will is","will been","be"]$j$,'will be'),
('en','futuro','A2','wll',3,'We ___ later. (talk)','поговорим позже','will talk',$j$["will talk","will talked","talks","will talking"]$j$,'will + base'),
('en','futuro','A2','wll',4,'They ___ tomorrow. (arrive)','они приедут завтра','will arrive',$j$["will arrive","will arrives","will arrived","arrive"]$j$,'will + base'),
('en','futuro','A2','wll',5,'I ___ you. (help)','я помогу тебе','will help',$j$["will help","will helps","will helped","help"]$j$,'will + base'),
('en','futuro','A2','wll',6,'It ___ tomorrow. (rain)','завтра пойдёт дождь','will rain',$j$["will rain","will rains","will rained","rain"]$j$,'will + base'),
('en','futuro','A2','wll',7,'He ___ the email. (send)','он отправит письмо','will send',$j$["will send","will sends","will sent","send"]$j$,'will + base'),
('en','futuro','A2','wll',8,'We ___ at home. (stay)','мы останемся дома','will stay',$j$["will stay","will stayed","will stays","stay"]$j$,'will + base');

-- ===== ARTICLES (a / an / the) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('en','article','A1','art',1,'I have ___ apple.','у меня есть яблоко','an',$j$["a","an","the","—"]$j$,'an — перед гласным звуком'),
('en','article','A1','art',2,'She is ___ doctor.','она врач','a',$j$["a","an","the","—"]$j$,'a — перед согласным звуком'),
('en','article','A1','art',3,'___ sun is hot.','солнце горячее','The',$j$["A","An","The","—"]$j$,'the — единственное в своём роде'),
('en','article','A2','art',4,'He is ___ honest man.','он честный человек','an',$j$["a","an","the","—"]$j$,'honest: h немое, звук гласный → an'),
('en','article','A1','art',5,'I bought ___ car.','я купил машину','a',$j$["a","an","the","—"]$j$,'a — новое упоминание, согласный'),
('en','article','A2','art',6,'This is ___ best film.','это лучший фильм','the',$j$["a","an","the","—"]$j$,'the — с превосходной степенью'),
('en','article','A2','art',7,'I like ___ music.','я люблю музыку','—',$j$["a","an","the","—"]$j$,'без артикля — неисчисляемое в общем смысле'),
('en','article','A1','art',8,'There is ___ egg.','есть яйцо','an',$j$["a","an","the","—"]$j$,'egg — гласный → an'),
('en','article','A2','art',9,'She plays ___ piano.','она играет на пианино','the',$j$["a","an","the","—"]$j$,'play the + инструмент'),
('en','article','A1','art',10,'___ Earth is round.','Земля круглая','The',$j$["A","An","The","—"]$j$,'the Earth — уникальный объект'),
('en','article','A1','art',11,'I have ___ umbrella.','у меня есть зонт','an',$j$["a","an","the","—"]$j$,'umbrella — гласный → an'),
('en','article','A2','art',12,'He is ___ university student.','он студент университета','a',$j$["a","an","the","—"]$j$,'university — звук [ju], согласный → a');

-- ===== PLURAL =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('en','plural','A1','pl',1,'cat → ?','кот → коты','cats',$j$["cats","cates","caties","cat"]$j$,'+s'),
('en','plural','A1','pl',2,'box → ?','коробка','boxes',$j$["boxs","boxes","boxies","box"]$j$,'после -x → +es'),
('en','plural','A1','pl',3,'baby → ?','малыш','babies',$j$["babys","babies","babyes","baby"]$j$,'согласная + y → -ies'),
('en','plural','A1','pl',4,'man → ?','мужчина','men',$j$["mans","men","mens","man"]$j$,'man → men (искл.)'),
('en','plural','A2','pl',5,'child → ?','ребёнок','children',$j$["childs","childer","children","childes"]$j$,'child → children (искл.)'),
('en','plural','A2','pl',6,'foot → ?','нога','feet',$j$["foots","feet","feets","foot"]$j$,'foot → feet (искл.)'),
('en','plural','A2','pl',7,'knife → ?','нож','knives',$j$["knifes","knives","knifs","knife"]$j$,'-fe → -ves'),
('en','plural','A1','pl',8,'city → ?','город','cities',$j$["citys","cities","cityes","city"]$j$,'согласная + y → -ies'),
('en','plural','A1','pl',9,'bus → ?','автобус','buses',$j$["buss","buses","busies","bus"]$j$,'после -s → +es'),
('en','plural','A2','pl',10,'mouse → ?','мышь','mice',$j$["mouses","mice","mouse","mices"]$j$,'mouse → mice (искл.)'),
('en','plural','A1','pl',11,'tomato → ?','помидор','tomatoes',$j$["tomatos","tomatoes","tomato","tomaties"]$j$,'после -o → +es'),
('en','plural','A2','pl',12,'leaf → ?','лист','leaves',$j$["leafs","leaves","leafes","leave"]$j$,'-f → -ves');

-- ===== COMPARATIVE / SUPERLATIVE =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('en','comparative','A2','cmp',1,'This is ___ than that. (big)','больше','bigger',$j$["bigger","more big","biggest","big"]$j$,'короткое прил.: +er (удвоение согл.)'),
('en','comparative','A2','cmp',2,'She is ___ than me. (tall)','выше','taller',$j$["taller","more tall","tallest","tall"]$j$,'+er'),
('en','comparative','A2','cmp',3,'This is ___ than that. (good)','лучше','better',$j$["gooder","better","best","more good"]$j$,'good → better (искл.)'),
('en','comparative','A2','cmp',4,'It is ___ than before. (bad)','хуже','worse',$j$["badder","worse","worst","more bad"]$j$,'bad → worse (искл.)'),
('en','comparative','B1','cmp',5,'This car is ___. (expensive)','дороже','more expensive',$j$["expensiver","more expensive","most expensive","expensivest"]$j$,'длинное прил.: more + …'),
('en','comparative','A2','cmp',6,'He is the ___ in class. (tall)','самый высокий','tallest',$j$["taller","tallest","most tall","tall"]$j$,'превосходная: the + -est'),
('en','comparative','A2','cmp',7,'This is the ___ film. (good)','лучший','best',$j$["goodest","best","better","most good"]$j$,'good → the best'),
('en','comparative','A2','cmp',8,'She is ___ than her sister. (happy)','счастливее','happier',$j$["happier","more happy","happiest","happy"]$j$,'-y → -ier'),
('en','comparative','B1','cmp',9,'This is the ___ book. (interesting)','самый интересный','most interesting',$j$["interestingest","most interesting","more interesting","interesting"]$j$,'длинное: the most + …'),
('en','comparative','A2','cmp',10,'Today is ___ than yesterday. (warm)','теплее','warmer',$j$["warmer","more warm","warmest","warm"]$j$,'+er');

-- ===== MODALS =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('en','modal','A2','mod',1,'I ___ swim very well.','умею плавать','can',$j$["can","must","should","may"]$j$,'can — умение/возможность'),
('en','modal','A2','mod',2,'You ___ stop at a red light.','должен остановиться','must',$j$["can","must","should","may"]$j$,'must — обязанность'),
('en','modal','A2','mod',3,'You look tired, you ___ rest.','тебе следует отдохнуть','should',$j$["can","must","should","may"]$j$,'should — совет'),
('en','modal','A2','mod',4,'___ I open the window?','можно открыть окно?','May',$j$["May","Must","Should","Would"]$j$,'may — вежливое разрешение'),
('en','modal','A2','mod',5,'I ___ speak three languages.','я говорю на трёх','can',$j$["can","must","should","may"]$j$,'can — умение'),
('en','modal','B1','mod',6,'We ___ be late, hurry up!','можем опоздать','may',$j$["may","should","can","must"]$j$,'may — вероятность'),
('en','modal','B1','mod',7,'You ___ smoke here, it is forbidden.','нельзя курить','must not',$j$["must not","should not","cannot","may not"]$j$,'must not — запрет'),
('en','modal','A2','mod',8,'He ___ go to the doctor.','ему следует пойти к врачу','should',$j$["should","can","may","must"]$j$,'should — рекомендация'),
('en','modal','A2','mod',9,'Students ___ do their homework.','должны делать домашнее задание','must',$j$["must","may","can","should"]$j$,'must — необходимость'),
('en','modal','B1','mod',10,'___ you help me, please?','не могли бы помочь','Could',$j$["Could","Must","Should","May"]$j$,'could — вежливая просьба');
