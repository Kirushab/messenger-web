-- 115_grammar_batch4.sql
-- Грамматика, батч 4: причастия (participio passato) и относительные (che/cui/chi).

DELETE FROM public.grammar_items WHERE language='it' AND kind IN ('participle','relative');

-- ===== ПРИЧАСТИЯ (образование) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','participle','B1','part',1,'parlare → ?','говорить → сказанное','parlato',$j$["parlato","parluto","parlito","parlando"]$j$,'-are → -ato'),
('it','participle','B1','part',2,'mangiare → ?','есть → съеденное','mangiato',$j$["mangiato","mangiuto","mangito","mangiando"]$j$,'-are → -ato'),
('it','participle','B1','part',3,'credere → ?','верить','creduto',$j$["creduto","credato","credito","credendo"]$j$,'-ere → -uto (правильное)'),
('it','participle','B1','part',4,'dormire → ?','спать','dormito',$j$["dormito","dormato","dormuto","dormendo"]$j$,'-ire → -ito'),
('it','participle','B1','part',5,'vedere → ?','видеть','visto',$j$["visto","vedito","vedato","vedendo"]$j$,'vedere → visto (неправильное)'),
('it','participle','B1','part',6,'fare → ?','делать','fatto',$j$["fatto","fato","facuto","facendo"]$j$,'fare → fatto (неправильное)'),
('it','participle','B1','part',7,'prendere → ?','брать','preso',$j$["preso","prenduto","presto","prendito"]$j$,'prendere → preso (неправильное)'),
('it','participle','B1','part',8,'scrivere → ?','писать','scritto',$j$["scritto","scrivuto","scrivto","scrivito"]$j$,'scrivere → scritto (неправильное)'),
('it','participle','B1','part',9,'leggere → ?','читать','letto',$j$["letto","legguto","legto","leggito"]$j$,'leggere → letto (неправильное)'),
('it','participle','B1','part',10,'aprire → ?','открывать','aperto',$j$["aperto","aprito","apruto","aprendo"]$j$,'aprire → aperto (неправильное)'),
('it','participle','B1','part',11,'dire → ?','сказать','detto',$j$["detto","dicuto","dito","dicendo"]$j$,'dire → detto (неправильное)'),
('it','participle','B1','part',12,'venire → ?','приходить','venuto',$j$["venuto","venito","vento","venendo"]$j$,'venire → venuto');

-- ===== ОТНОСИТЕЛЬНЫЕ МЕСТОИМЕНИЯ =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','relative','B1','rel',1,'Il libro ___ leggo è interessante.','книга, которую я читаю','che',$j$["che","cui","chi","dove"]$j$,'che — подлежащее или прямое дополнение'),
('it','relative','B1','rel',2,'La ragazza ___ parla è Anna.','девушка, которая говорит','che',$j$["che","cui","chi","dove"]$j$,'che — подлежащее'),
('it','relative','B1','rel',3,'La città in ___ vivo è grande.','город, в котором я живу','cui',$j$["cui","che","chi","dove"]$j$,'после предлога → cui (in cui)'),
('it','relative','B1','rel',4,'L''amico a ___ scrivo è Marco.','друг, которому я пишу','cui',$j$["cui","che","chi","dove"]$j$,'a cui — которому'),
('it','relative','B1','rel',5,'Il film di ___ parlo è famoso.','фильм, о котором я говорю','cui',$j$["cui","che","chi","dove"]$j$,'di cui — о котором'),
('it','relative','B1','rel',6,'La casa ___ vedi è mia.','дом, который ты видишь','che',$j$["che","cui","chi","dove"]$j$,'che — прямое дополнение'),
('it','relative','B1','rel',7,'Non so ___ ha telefonato.','не знаю, кто звонил','chi',$j$["chi","che","cui","dove"]$j$,'chi — кто / тот, кто');
