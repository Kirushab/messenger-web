-- 114_grammar_batch3.sql
-- Грамматика, батч 3: congiuntivo, imperativo, ci/ne + косвенные, неправильные глаголы (presente).

DELETE FROM public.grammar_items WHERE language='it' AND kind IN ('congiuntivo','imperativo','cine');
DELETE FROM public.grammar_items WHERE language='it' AND kind='conjugation'
  AND topic IN ('venire','uscire','sapere','dire','bere');

-- ===== Неправильные глаголы (presente), добавляем в «Настоящее» =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','conjugation','A2','venire',1,'io (venire)','я (приходить)','vengo',NULL,'venire: vengo, vieni, viene, veniamo, venite, vengono'),
('it','conjugation','A2','venire',2,'tu (venire)','ты (приходить)','vieni',NULL,'venire: vengo, vieni, viene, veniamo, venite, vengono'),
('it','conjugation','A2','venire',3,'lui/lei (venire)','он/она (приходить)','viene',NULL,'venire: vengo, vieni, viene, veniamo, venite, vengono'),
('it','conjugation','A2','venire',4,'noi (venire)','мы (приходить)','veniamo',NULL,'venire: vengo, vieni, viene, veniamo, venite, vengono'),
('it','conjugation','A2','venire',5,'voi (venire)','вы (приходить)','venite',NULL,'venire: vengo, vieni, viene, veniamo, venite, vengono'),
('it','conjugation','A2','venire',6,'loro (venire)','они (приходить)','vengono',NULL,'venire: vengo, vieni, viene, veniamo, venite, vengono'),
('it','conjugation','A2','uscire',1,'io (uscire)','я (выходить)','esco',NULL,'uscire: esco, esci, esce, usciamo, uscite, escono'),
('it','conjugation','A2','uscire',2,'tu (uscire)','ты (выходить)','esci',NULL,'uscire: esco, esci, esce, usciamo, uscite, escono'),
('it','conjugation','A2','uscire',3,'lui/lei (uscire)','он/она (выходить)','esce',NULL,'uscire: esco, esci, esce, usciamo, uscite, escono'),
('it','conjugation','A2','uscire',4,'noi (uscire)','мы (выходить)','usciamo',NULL,'uscire: esco, esci, esce, usciamo, uscite, escono'),
('it','conjugation','A2','uscire',5,'voi (uscire)','вы (выходить)','uscite',NULL,'uscire: esco, esci, esce, usciamo, uscite, escono'),
('it','conjugation','A2','uscire',6,'loro (uscire)','они (выходить)','escono',NULL,'uscire: esco, esci, esce, usciamo, uscite, escono'),
('it','conjugation','A2','sapere',1,'io (sapere)','я (знать)','so',NULL,'sapere: so, sai, sa, sappiamo, sapete, sanno'),
('it','conjugation','A2','sapere',2,'tu (sapere)','ты (знать)','sai',NULL,'sapere: so, sai, sa, sappiamo, sapete, sanno'),
('it','conjugation','A2','sapere',3,'lui/lei (sapere)','он/она (знать)','sa',NULL,'sapere: so, sai, sa, sappiamo, sapete, sanno'),
('it','conjugation','A2','sapere',4,'noi (sapere)','мы (знать)','sappiamo',NULL,'sapere: so, sai, sa, sappiamo, sapete, sanno'),
('it','conjugation','A2','sapere',5,'voi (sapere)','вы (знать)','sapete',NULL,'sapere: so, sai, sa, sappiamo, sapete, sanno'),
('it','conjugation','A2','sapere',6,'loro (sapere)','они (знать)','sanno',NULL,'sapere: so, sai, sa, sappiamo, sapete, sanno'),
('it','conjugation','A2','dire',1,'io (dire)','я (сказать)','dico',NULL,'dire: dico, dici, dice, diciamo, dite, dicono'),
('it','conjugation','A2','dire',2,'tu (dire)','ты (сказать)','dici',NULL,'dire: dico, dici, dice, diciamo, dite, dicono'),
('it','conjugation','A2','dire',3,'lui/lei (dire)','он/она (сказать)','dice',NULL,'dire: dico, dici, dice, diciamo, dite, dicono'),
('it','conjugation','A2','dire',4,'noi (dire)','мы (сказать)','diciamo',NULL,'dire: dico, dici, dice, diciamo, dite, dicono'),
('it','conjugation','A2','dire',5,'voi (dire)','вы (сказать)','dite',NULL,'dire: dico, dici, dice, diciamo, dite, dicono'),
('it','conjugation','A2','dire',6,'loro (dire)','они (сказать)','dicono',NULL,'dire: dico, dici, dice, diciamo, dite, dicono'),
('it','conjugation','A2','bere',1,'io (bere)','я (пить)','bevo',NULL,'bere: bevo, bevi, beve, beviamo, bevete, bevono'),
('it','conjugation','A2','bere',2,'tu (bere)','ты (пить)','bevi',NULL,'bere: bevo, bevi, beve, beviamo, bevete, bevono'),
('it','conjugation','A2','bere',3,'lui/lei (bere)','он/она (пить)','beve',NULL,'bere: bevo, bevi, beve, beviamo, bevete, bevono'),
('it','conjugation','A2','bere',4,'noi (bere)','мы (пить)','beviamo',NULL,'bere: bevo, bevi, beve, beviamo, bevete, bevono'),
('it','conjugation','A2','bere',5,'voi (bere)','вы (пить)','bevete',NULL,'bere: bevo, bevi, beve, beviamo, bevete, bevono'),
('it','conjugation','A2','bere',6,'loro (bere)','они (пить)','bevono',NULL,'bere: bevo, bevi, beve, beviamo, bevete, bevono');

-- ===== CONGIUNTIVO PRESENTE =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','congiuntivo','B2','cong_parlare',1,'che io (parlare)','чтобы я говорил','parli',NULL,'Congiuntivo -are: -i, -i, -i, -iamo, -iate, -ino (после che, voglio che…)'),
('it','congiuntivo','B2','cong_parlare',2,'che tu (parlare)','чтобы ты говорил','parli',NULL,'Congiuntivo -are: -i, -i, -i, -iamo, -iate, -ino'),
('it','congiuntivo','B2','cong_parlare',3,'che lui/lei (parlare)','чтобы он/она говорил(а)','parli',NULL,'Congiuntivo -are: -i, -i, -i, -iamo, -iate, -ino'),
('it','congiuntivo','B2','cong_parlare',4,'che noi (parlare)','чтобы мы говорили','parliamo',NULL,'Congiuntivo -are: -i, -i, -i, -iamo, -iate, -ino'),
('it','congiuntivo','B2','cong_parlare',5,'che voi (parlare)','чтобы вы говорили','parliate',NULL,'Congiuntivo -are: -i, -i, -i, -iamo, -iate, -ino'),
('it','congiuntivo','B2','cong_parlare',6,'che loro (parlare)','чтобы они говорили','parlino',NULL,'Congiuntivo -are: -i, -i, -i, -iamo, -iate, -ino'),
('it','congiuntivo','B2','cong_essere',1,'che io (essere)','чтобы я был','sia',NULL,'essere cong.: sia, sia, sia, siamo, siate, siano'),
('it','congiuntivo','B2','cong_essere',2,'che tu (essere)','чтобы ты был','sia',NULL,'essere cong.: sia, sia, sia, siamo, siate, siano'),
('it','congiuntivo','B2','cong_essere',3,'che lui/lei (essere)','чтобы он/она был(а)','sia',NULL,'essere cong.: sia, sia, sia, siamo, siate, siano'),
('it','congiuntivo','B2','cong_essere',4,'che noi (essere)','чтобы мы были','siamo',NULL,'essere cong.: sia, sia, sia, siamo, siate, siano'),
('it','congiuntivo','B2','cong_essere',5,'che voi (essere)','чтобы вы были','siate',NULL,'essere cong.: sia, sia, sia, siamo, siate, siano'),
('it','congiuntivo','B2','cong_essere',6,'che loro (essere)','чтобы они были','siano',NULL,'essere cong.: sia, sia, sia, siamo, siate, siano'),
('it','congiuntivo','B2','cong_avere',1,'che io (avere)','чтобы у меня было','abbia',NULL,'avere cong.: abbia, abbia, abbia, abbiamo, abbiate, abbiano'),
('it','congiuntivo','B2','cong_avere',2,'che tu (avere)','чтобы у тебя было','abbia',NULL,'avere cong.: abbia, abbia, abbia, abbiamo, abbiate, abbiano'),
('it','congiuntivo','B2','cong_avere',3,'che lui/lei (avere)','чтобы у него/неё было','abbia',NULL,'avere cong.: abbia, abbia, abbia, abbiamo, abbiate, abbiano'),
('it','congiuntivo','B2','cong_avere',4,'che noi (avere)','чтобы у нас было','abbiamo',NULL,'avere cong.: abbia, abbia, abbia, abbiamo, abbiate, abbiano'),
('it','congiuntivo','B2','cong_avere',5,'che voi (avere)','чтобы у вас было','abbiate',NULL,'avere cong.: abbia, abbia, abbia, abbiamo, abbiate, abbiano'),
('it','congiuntivo','B2','cong_avere',6,'che loro (avere)','чтобы у них было','abbiano',NULL,'avere cong.: abbia, abbia, abbia, abbiamo, abbiate, abbiano'),
('it','congiuntivo','B2','cong_andare',1,'che io (andare)','чтобы я шёл','vada',NULL,'andare cong.: vada, vada, vada, andiamo, andiate, vadano'),
('it','congiuntivo','B2','cong_andare',2,'che tu (andare)','чтобы ты шёл','vada',NULL,'andare cong.: vada, vada, vada, andiamo, andiate, vadano'),
('it','congiuntivo','B2','cong_andare',3,'che lui/lei (andare)','чтобы он/она шёл(шла)','vada',NULL,'andare cong.: vada, vada, vada, andiamo, andiate, vadano'),
('it','congiuntivo','B2','cong_andare',4,'che noi (andare)','чтобы мы шли','andiamo',NULL,'andare cong.: vada, vada, vada, andiamo, andiate, vadano'),
('it','congiuntivo','B2','cong_andare',5,'che voi (andare)','чтобы вы шли','andiate',NULL,'andare cong.: vada, vada, vada, andiamo, andiate, vadano'),
('it','congiuntivo','B2','cong_andare',6,'che loro (andare)','чтобы они шли','vadano',NULL,'andare cong.: vada, vada, vada, andiamo, andiate, vadano');

-- ===== IMPERATIVO =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','imperativo','B1','imp',1,'(tu) ___! (parlare)','Говори!','parla',$j$["parla","parli","parlo","parlare"]$j$,'-are, tu: -a → parla!'),
('it','imperativo','B1','imp',2,'(tu) ___! (prendere)','Бери!','prendi',$j$["prendi","prenda","prende","prendere"]$j$,'-ere/-ire, tu: -i → prendi!'),
('it','imperativo','B1','imp',3,'(tu) ___! (dormire)','Спи!','dormi',$j$["dormi","dorma","dormo","dormire"]$j$,'-ire, tu: -i → dormi!'),
('it','imperativo','B1','imp',4,'(tu) non ___! (parlare)','Не говори!','non parlare',$j$["non parlare","non parli","non parla","no parlare"]$j$,'Отриц. tu: non + инфинитив'),
('it','imperativo','B1','imp',5,'(noi) ___! (mangiare)','Давайте поедим!','mangiamo',$j$["mangiamo","mangiate","mangia","mangiano"]$j$,'noi: -iamo'),
('it','imperativo','B1','imp',6,'(voi) ___! (parlare)','Говорите!','parlate',$j$["parlate","parla","parliamo","parlano"]$j$,'voi: -ate'),
('it','imperativo','B1','imp',7,'(tu) ___! (andare)','Иди!','va''',$j$["va'","vada","vado","andare"]$j$,'andare tu: va'' (или vai)'),
('it','imperativo','B1','imp',8,'(tu) ___! (fare)','Делай!','fa''',$j$["fa'","faccia","facci","fare"]$j$,'fare tu: fa'' (или fai)'),
('it','imperativo','B1','imp',9,'(tu) ___! (dire)','Скажи!','di''',$j$["di'","dica","dico","dire"]$j$,'dire tu: di'''),
('it','imperativo','B1','imp',10,'(tu) ___! (venire)','Иди сюда!','vieni',$j$["vieni","venga","vengo","venire"]$j$,'venire tu: vieni!');

-- ===== CI / NE + косвенные местоимения =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','cine','B1','cine',1,'Quante mele vuoi? — ___ voglio tre.','Сколько яблок? — Хочу три (из них)','ne',$j$["ne","ci","le","li"]$j$,'ne — заменяет количество/часть'),
('it','cine','B1','cine',2,'Vai a Roma? — Sì, ___ vado domani.','...да, еду туда завтра','ci',$j$["ci","ne","lo","vi"]$j$,'ci — заменяет место (туда)'),
('it','cine','B1','cine',3,'Telefoni a Marco? — Sì, ___ telefono.','...да, звоню ему','gli',$j$["gli","le","lo","ci"]$j$,'gli — ему (косвенное, муж.)'),
('it','cine','B1','cine',4,'Scrivi a Maria? — Sì, ___ scrivo.','...да, пишу ей','le',$j$["le","gli","la","ne"]$j$,'le — ей (косвенное, жен.)'),
('it','cine','B1','cine',5,'Hai del pane? — Sì, ___ ho.','...да, есть немного','ne',$j$["ne","lo","ci","li"]$j$,'ne — немного его (часть)'),
('it','cine','B1','cine',6,'Pensi al lavoro? — Sì, ___ penso.','...да, думаю об этом','ci',$j$["ci","ne","lo","gli"]$j$,'pensare a → ci'),
('it','cine','B1','cine',7,'Parli ai tuoi amici? — Sì, ___ parlo.','...да, говорю с ними','gli',$j$["gli","le","li","ne"]$j$,'gli — им (мн., косвенное)'),
('it','cine','B1','cine',8,'Quanti anni hai? — ___ ho venti.','Сколько тебе лет? — Двадцать','ne',$j$["ne","ci","li","le"]$j$,'ne — из них (venti anni)');
