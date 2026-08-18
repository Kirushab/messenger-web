-- 104_grammar_batch2.sql
-- Грамматика, батч 2: imperfetto, futuro, condizionale, возвратные, местоимения-дополнения, сравнения.

DELETE FROM public.grammar_items WHERE language='it' AND kind IN ('imperfetto','futuro','condizionale','reflexive','pronoun','comparative');

-- ===== IMPERFETTO =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','imperfetto','B1','imp_parlare',1,'io (parlare)','я говорил','parlavo',NULL,'Imperfetto -are: -avo, -avi, -ava, -avamo, -avate, -avano'),
('it','imperfetto','B1','imp_parlare',2,'tu (parlare)','ты говорил','parlavi',NULL,'Imperfetto -are: -avo, -avi, -ava, -avamo, -avate, -avano'),
('it','imperfetto','B1','imp_parlare',3,'lui/lei (parlare)','он/она говорил(а)','parlava',NULL,'Imperfetto -are: -avo, -avi, -ava, -avamo, -avate, -avano'),
('it','imperfetto','B1','imp_parlare',4,'noi (parlare)','мы говорили','parlavamo',NULL,'Imperfetto -are: -avo, -avi, -ava, -avamo, -avate, -avano'),
('it','imperfetto','B1','imp_parlare',5,'voi (parlare)','вы говорили','parlavate',NULL,'Imperfetto -are: -avo, -avi, -ava, -avamo, -avate, -avano'),
('it','imperfetto','B1','imp_parlare',6,'loro (parlare)','они говорили','parlavano',NULL,'Imperfetto -are: -avo, -avi, -ava, -avamo, -avate, -avano'),
('it','imperfetto','B1','imp_prendere',1,'io (prendere)','я брал','prendevo',NULL,'Imperfetto -ere: -evo, -evi, -eva, -evamo, -evate, -evano'),
('it','imperfetto','B1','imp_prendere',2,'tu (prendere)','ты брал','prendevi',NULL,'Imperfetto -ere: -evo, -evi, -eva, -evamo, -evate, -evano'),
('it','imperfetto','B1','imp_prendere',3,'lui/lei (prendere)','он/она брал(а)','prendeva',NULL,'Imperfetto -ere: -evo, -evi, -eva, -evamo, -evate, -evano'),
('it','imperfetto','B1','imp_prendere',4,'noi (prendere)','мы брали','prendevamo',NULL,'Imperfetto -ere: -evo, -evi, -eva, -evamo, -evate, -evano'),
('it','imperfetto','B1','imp_prendere',5,'voi (prendere)','вы брали','prendevate',NULL,'Imperfetto -ere: -evo, -evi, -eva, -evamo, -evate, -evano'),
('it','imperfetto','B1','imp_prendere',6,'loro (prendere)','они брали','prendevano',NULL,'Imperfetto -ere: -evo, -evi, -eva, -evamo, -evate, -evano'),
('it','imperfetto','B1','imp_essere',1,'io (essere)','я был','ero',NULL,'essere imperfetto: ero, eri, era, eravamo, eravate, erano'),
('it','imperfetto','B1','imp_essere',2,'tu (essere)','ты был','eri',NULL,'essere imperfetto: ero, eri, era, eravamo, eravate, erano'),
('it','imperfetto','B1','imp_essere',3,'lui/lei (essere)','он/она был(а)','era',NULL,'essere imperfetto: ero, eri, era, eravamo, eravate, erano'),
('it','imperfetto','B1','imp_essere',4,'noi (essere)','мы были','eravamo',NULL,'essere imperfetto: ero, eri, era, eravamo, eravate, erano'),
('it','imperfetto','B1','imp_essere',5,'voi (essere)','вы были','eravate',NULL,'essere imperfetto: ero, eri, era, eravamo, eravate, erano'),
('it','imperfetto','B1','imp_essere',6,'loro (essere)','они были','erano',NULL,'essere imperfetto: ero, eri, era, eravamo, eravate, erano');

-- ===== FUTURO SEMPLICE =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','futuro','B1','fut_parlare',1,'io (parlare)','я буду говорить','parlerò',NULL,'Futuro -are: -erò, -erai, -erà, -eremo, -erete, -eranno'),
('it','futuro','B1','fut_parlare',2,'tu (parlare)','ты будешь говорить','parlerai',NULL,'Futuro -are: -erò, -erai, -erà, -eremo, -erete, -eranno'),
('it','futuro','B1','fut_parlare',3,'lui/lei (parlare)','он/она будет говорить','parlerà',NULL,'Futuro -are: -erò, -erai, -erà, -eremo, -erete, -eranno'),
('it','futuro','B1','fut_parlare',4,'noi (parlare)','мы будем говорить','parleremo',NULL,'Futuro -are: -erò, -erai, -erà, -eremo, -erete, -eranno'),
('it','futuro','B1','fut_parlare',5,'voi (parlare)','вы будете говорить','parlerete',NULL,'Futuro -are: -erò, -erai, -erà, -eremo, -erete, -eranno'),
('it','futuro','B1','fut_parlare',6,'loro (parlare)','они будут говорить','parleranno',NULL,'Futuro -are: -erò, -erai, -erà, -eremo, -erete, -eranno'),
('it','futuro','B1','fut_essere',1,'io (essere)','я буду','sarò',NULL,'essere futuro: sarò, sarai, sarà, saremo, sarete, saranno'),
('it','futuro','B1','fut_essere',2,'tu (essere)','ты будешь','sarai',NULL,'essere futuro: sarò, sarai, sarà, saremo, sarete, saranno'),
('it','futuro','B1','fut_essere',3,'lui/lei (essere)','он/она будет','sarà',NULL,'essere futuro: sarò, sarai, sarà, saremo, sarete, saranno'),
('it','futuro','B1','fut_essere',4,'noi (essere)','мы будем','saremo',NULL,'essere futuro: sarò, sarai, sarà, saremo, sarete, saranno'),
('it','futuro','B1','fut_essere',5,'voi (essere)','вы будете','sarete',NULL,'essere futuro: sarò, sarai, sarà, saremo, sarete, saranno'),
('it','futuro','B1','fut_essere',6,'loro (essere)','они будут','saranno',NULL,'essere futuro: sarò, sarai, sarà, saremo, sarete, saranno'),
('it','futuro','B1','fut_avere',1,'io (avere)','у меня будет','avrò',NULL,'avere futuro: avrò, avrai, avrà, avremo, avrete, avranno'),
('it','futuro','B1','fut_avere',2,'tu (avere)','у тебя будет','avrai',NULL,'avere futuro: avrò, avrai, avrà, avremo, avrete, avranno'),
('it','futuro','B1','fut_avere',3,'lui/lei (avere)','у него/неё будет','avrà',NULL,'avere futuro: avrò, avrai, avrà, avremo, avrete, avranno'),
('it','futuro','B1','fut_avere',4,'noi (avere)','у нас будет','avremo',NULL,'avere futuro: avrò, avrai, avrà, avremo, avrete, avranno'),
('it','futuro','B1','fut_avere',5,'voi (avere)','у вас будет','avrete',NULL,'avere futuro: avrò, avrai, avrà, avremo, avrete, avranno'),
('it','futuro','B1','fut_avere',6,'loro (avere)','у них будет','avranno',NULL,'avere futuro: avrò, avrai, avrà, avremo, avrete, avranno');

-- ===== CONDIZIONALE PRESENTE =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','condizionale','B1','cond_parlare',1,'io (parlare)','я бы говорил','parlerei',NULL,'Condizionale -are: -erei, -eresti, -erebbe, -eremmo, -ereste, -erebbero'),
('it','condizionale','B1','cond_parlare',2,'tu (parlare)','ты бы говорил','parleresti',NULL,'Condizionale -are: -erei, -eresti, -erebbe, -eremmo, -ereste, -erebbero'),
('it','condizionale','B1','cond_parlare',3,'lui/lei (parlare)','он/она бы говорил(а)','parlerebbe',NULL,'Condizionale -are: -erei, -eresti, -erebbe, -eremmo, -ereste, -erebbero'),
('it','condizionale','B1','cond_parlare',4,'noi (parlare)','мы бы говорили','parleremmo',NULL,'Condizionale -are: -erei, -eresti, -erebbe, -eremmo, -ereste, -erebbero'),
('it','condizionale','B1','cond_parlare',5,'voi (parlare)','вы бы говорили','parlereste',NULL,'Condizionale -are: -erei, -eresti, -erebbe, -eremmo, -ereste, -erebbero'),
('it','condizionale','B1','cond_parlare',6,'loro (parlare)','они бы говорили','parlerebbero',NULL,'Condizionale -are: -erei, -eresti, -erebbe, -eremmo, -ereste, -erebbero'),
('it','condizionale','B1','cond_essere',1,'io (essere)','я бы был','sarei',NULL,'essere condizionale: sarei, saresti, sarebbe, saremmo, sareste, sarebbero'),
('it','condizionale','B1','cond_essere',2,'tu (essere)','ты бы был','saresti',NULL,'essere condizionale: sarei, saresti, sarebbe, saremmo, sareste, sarebbero'),
('it','condizionale','B1','cond_essere',3,'lui/lei (essere)','он/она бы был(а)','sarebbe',NULL,'essere condizionale: sarei, saresti, sarebbe, saremmo, sareste, sarebbero'),
('it','condizionale','B1','cond_essere',4,'noi (essere)','мы бы были','saremmo',NULL,'essere condizionale: sarei, saresti, sarebbe, saremmo, sareste, sarebbero'),
('it','condizionale','B1','cond_essere',5,'voi (essere)','вы бы были','sareste',NULL,'essere condizionale: sarei, saresti, sarebbe, saremmo, sareste, sarebbero'),
('it','condizionale','B1','cond_essere',6,'loro (essere)','они бы были','sarebbero',NULL,'essere condizionale: sarei, saresti, sarebbe, saremmo, sareste, sarebbero'),
('it','condizionale','B1','cond_volere',1,'io (volere)','я бы хотел','vorrei',NULL,'volere condizionale: vorrei, vorresti, vorrebbe, vorremmo, vorreste, vorrebbero'),
('it','condizionale','B1','cond_volere',2,'tu (volere)','ты бы хотел','vorresti',NULL,'volere condizionale: vorrei, vorresti, vorrebbe, vorremmo, vorreste, vorrebbero'),
('it','condizionale','B1','cond_volere',3,'lui/lei (volere)','он/она бы хотел(а)','vorrebbe',NULL,'volere condizionale: vorrei, vorresti, vorrebbe, vorremmo, vorreste, vorrebbero'),
('it','condizionale','B1','cond_volere',4,'noi (volere)','мы бы хотели','vorremmo',NULL,'volere condizionale: vorrei, vorresti, vorrebbe, vorremmo, vorreste, vorrebbero'),
('it','condizionale','B1','cond_volere',5,'voi (volere)','вы бы хотели','vorreste',NULL,'volere condizionale: vorrei, vorresti, vorrebbe, vorremmo, vorreste, vorrebbero'),
('it','condizionale','B1','cond_volere',6,'loro (volere)','они бы хотели','vorrebbero',NULL,'volere condizionale: vorrei, vorresti, vorrebbe, vorremmo, vorreste, vorrebbero');

-- ===== ВОЗВРАТНЫЕ (выбор возвратного местоимения) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','reflexive','A2','refl',1,'io ___ chiamo Anna (chiamarsi)','меня зовут Анна','mi',$j$["mi","ti","si","ci","vi"]$j$,'io → mi'),
('it','reflexive','A2','refl',2,'tu come ___ chiami? (chiamarsi)','как тебя зовут?','ti',$j$["mi","ti","si","ci","vi"]$j$,'tu → ti'),
('it','reflexive','A2','refl',3,'lui ___ alza presto (alzarsi)','он встаёт рано','si',$j$["mi","ti","si","ci","vi"]$j$,'lui/lei → si'),
('it','reflexive','A2','refl',4,'noi ___ laviamo (lavarsi)','мы умываемся','ci',$j$["mi","ti","si","ci","vi"]$j$,'noi → ci'),
('it','reflexive','A2','refl',5,'voi ___ svegliate tardi (svegliarsi)','вы просыпаетесь поздно','vi',$j$["mi","ti","si","ci","vi"]$j$,'voi → vi'),
('it','reflexive','A2','refl',6,'loro ___ chiamano Rossi (chiamarsi)','их фамилия Росси','si',$j$["mi","ti","si","ci","vi"]$j$,'loro → si'),
('it','reflexive','A2','refl',7,'io ___ sveglio alle sette (svegliarsi)','я просыпаюсь в семь','mi',$j$["mi","ti","si","ci","vi"]$j$,'io → mi'),
('it','reflexive','A2','refl',8,'tu ___ lavi le mani (lavarsi)','ты моешь руки','ti',$j$["mi","ti","si","ci","vi"]$j$,'tu → ti');

-- ===== МЕСТОИМЕНИЯ-ДОПОЛНЕНИЯ (lo/la/li/le) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','pronoun','B1','dop',1,'Vedi Marco? — Sì, ___ vedo.','...да, вижу его','lo',$j$["lo","la","li","le"]$j$,'Marco — м.р. ед. → lo'),
('it','pronoun','B1','dop',2,'Vedi Maria? — Sì, ___ vedo.','...да, вижу её','la',$j$["lo","la","li","le"]$j$,'Maria — ж.р. ед. → la'),
('it','pronoun','B1','dop',3,'Compri i libri? — Sì, ___ compro.','...да, покупаю их','li',$j$["lo","la","li","le"]$j$,'i libri — м.р. мн. → li'),
('it','pronoun','B1','dop',4,'Mangi le mele? — Sì, ___ mangio.','...да, ем их','le',$j$["lo","la","li","le"]$j$,'le mele — ж.р. мн. → le'),
('it','pronoun','B1','dop',5,'Conosci Anna? — Sì, ___ conosco.','...да, знаю её','la',$j$["lo","la","li","le"]$j$,'ж.р. ед. → la'),
('it','pronoun','B1','dop',6,'Leggi il giornale? — Sì, ___ leggo.','...да, читаю его','lo',$j$["lo","la","li","le"]$j$,'м.р. ед. → lo');

-- ===== СРАВНЕНИЯ =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','comparative','B1','comp',1,'Marco è più alto ___ Luca.','Марко выше Луки','di',$j$["di","che","come","più"]$j$,'più ... di (перед существительным/именем)'),
('it','comparative','B1','comp',2,'È ___ alto della classe.','Он самый высокий в классе','il più',$j$["il più","più","meno","tanto"]$j$,'Превосходная степень: il più ...'),
('it','comparative','B1','comp',3,'Questo è ___ caro di quello.','Это менее дорогое, чем то','meno',$j$["meno","più","come","tanto"]$j$,'meno ... di — менее ... чем'),
('it','comparative','B1','comp',4,'Lei è alta ___ me.','Она такого же роста, как я','come',$j$["come","di","che","più"]$j$,'Равенство: ... come ...'),
('it','comparative','B1','comp',5,'Leggo più libri ___ riviste.','Я читаю больше книг, чем журналов','che',$j$["che","di","come","meno"]$j$,'più ... che (между двумя существительными)'),
('it','comparative','B1','comp',6,'Roma è più grande ___ Pisa.','Рим больше Пизы','di',$j$["di","che","come","meno"]$j$,'più ... di (перед именем)');
