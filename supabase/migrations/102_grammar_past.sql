-- 102_grammar_past.sql
-- Грамматика: прошедшее время (passato prossimo) — выбор вспомогательного глагола essere/avere.

DELETE FROM public.grammar_items WHERE language='it' AND kind='past';

INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
-- Глаголы движения/состояния → essere (причастие согласуется в роде и числе)
('it','past','B1','andare',1,'io ___ andato (andare)','я пошёл','sono',$j$["ho","sono"]$j$,'Движение → essere; причастие: andato/andata/andati/andate'),
('it','past','B1','andare',2,'lei ___ andata (andare)','она пошла','è',$j$["ha","è"]$j$,'Движение → essere; причастие согласуется в роде (andata)'),
('it','past','B1','partire',3,'loro ___ partiti (partire)','они уехали','sono',$j$["hanno","sono"]$j$,'Движение → essere; во мн. числе причастие → -i'),
('it','past','B1','tornare',4,'noi ___ tornati (tornare)','мы вернулись','siamo',$j$["abbiamo","siamo"]$j$,'Движение → essere'),
('it','past','B1','venire',5,'tu ___ venuto (venire)','ты пришёл','sei',$j$["hai","sei"]$j$,'Движение → essere; venire → venuto'),
('it','past','B1','nascere',6,'io ___ nato (nascere)','я родился','sono',$j$["ho","sono"]$j$,'nascere → essere; причастие nato'),
('it','past','B1','uscire',7,'lui ___ uscito (uscire)','он вышел','è',$j$["ha","è"]$j$,'Движение → essere'),
('it','past','B1','arrivare',8,'voi ___ arrivati (arrivare)','вы приехали','siete',$j$["avete","siete"]$j$,'Движение → essere'),
-- Переходные глаголы → avere (причастие не меняется)
('it','past','B1','mangiare',9,'io ___ mangiato (mangiare)','я поел','ho',$j$["ho","sono"]$j$,'Переходный → avere; причастие не меняется'),
('it','past','B1','parlare',10,'tu ___ parlato (parlare)','ты поговорил','hai',$j$["hai","sei"]$j$,'avere; причастие не меняется'),
('it','past','B1','vedere',11,'lui ___ visto (vedere)','он увидел','ha',$j$["ha","è"]$j$,'avere; vedere → visto (неправильное причастие)'),
('it','past','B1','comprare',12,'noi ___ comprato (comprare)','мы купили','abbiamo',$j$["abbiamo","siamo"]$j$,'avere; причастие не меняется'),
('it','past','B1','fare',13,'voi ___ fatto (fare)','вы сделали','avete',$j$["avete","siete"]$j$,'avere; fare → fatto'),
('it','past','B1','leggere',14,'loro ___ letto (leggere)','они прочитали','hanno',$j$["hanno","sono"]$j$,'avere; leggere → letto'),
('it','past','B1','scrivere',15,'io ___ scritto (scrivere)','я написал','ho',$j$["ho","sono"]$j$,'avere; scrivere → scritto'),
('it','past','B1','studiare',16,'tu ___ studiato (studiare)','ты учил','hai',$j$["hai","sei"]$j$,'avere'),
('it','past','B1','finire',17,'lui ___ finito (finire)','он закончил','ha',$j$["ha","è"]$j$,'avere (переходный): ha finito il lavoro'),
('it','past','B1','prendere',18,'noi ___ preso (prendere)','мы взяли','abbiamo',$j$["abbiamo","siamo"]$j$,'avere; prendere → preso');
