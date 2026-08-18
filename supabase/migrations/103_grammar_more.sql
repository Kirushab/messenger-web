-- 103_grammar_more.sql
-- Грамматика, батч 1: модальные глаголы, мн. число, прилагательные, предлоги, притяжательные.

DELETE FROM public.grammar_items WHERE language='it' AND kind IN ('modal','plural','adjective','preposition','possessive');

-- ===== Модальные глаголы (presente) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','modal','A2','potere',1,'io (potere)','я (мочь)','posso',NULL,'potere: posso, puoi, può, possiamo, potete, possono'),
('it','modal','A2','potere',2,'tu (potere)','ты (мочь)','puoi',NULL,'potere: posso, puoi, può, possiamo, potete, possono'),
('it','modal','A2','potere',3,'lui/lei (potere)','он/она (мочь)','può',NULL,'potere: posso, puoi, può, possiamo, potete, possono'),
('it','modal','A2','potere',4,'noi (potere)','мы (мочь)','possiamo',NULL,'potere: posso, puoi, può, possiamo, potete, possono'),
('it','modal','A2','potere',5,'voi (potere)','вы (мочь)','potete',NULL,'potere: posso, puoi, può, possiamo, potete, possono'),
('it','modal','A2','potere',6,'loro (potere)','они (мочь)','possono',NULL,'potere: posso, puoi, può, possiamo, potete, possono'),
('it','modal','A2','volere',1,'io (volere)','я (хотеть)','voglio',NULL,'volere: voglio, vuoi, vuole, vogliamo, volete, vogliono'),
('it','modal','A2','volere',2,'tu (volere)','ты (хотеть)','vuoi',NULL,'volere: voglio, vuoi, vuole, vogliamo, volete, vogliono'),
('it','modal','A2','volere',3,'lui/lei (volere)','он/она (хотеть)','vuole',NULL,'volere: voglio, vuoi, vuole, vogliamo, volete, vogliono'),
('it','modal','A2','volere',4,'noi (volere)','мы (хотеть)','vogliamo',NULL,'volere: voglio, vuoi, vuole, vogliamo, volete, vogliono'),
('it','modal','A2','volere',5,'voi (volere)','вы (хотеть)','volete',NULL,'volere: voglio, vuoi, vuole, vogliamo, volete, vogliono'),
('it','modal','A2','volere',6,'loro (volere)','они (хотеть)','vogliono',NULL,'volere: voglio, vuoi, vuole, vogliamo, volete, vogliono'),
('it','modal','A2','dovere',1,'io (dovere)','я (быть должным)','devo',NULL,'dovere: devo, devi, deve, dobbiamo, dovete, devono'),
('it','modal','A2','dovere',2,'tu (dovere)','ты (быть должным)','devi',NULL,'dovere: devo, devi, deve, dobbiamo, dovete, devono'),
('it','modal','A2','dovere',3,'lui/lei (dovere)','он/она (быть должным)','deve',NULL,'dovere: devo, devi, deve, dobbiamo, dovete, devono'),
('it','modal','A2','dovere',4,'noi (dovere)','мы (быть должными)','dobbiamo',NULL,'dovere: devo, devi, deve, dobbiamo, dovete, devono'),
('it','modal','A2','dovere',5,'voi (dovere)','вы (быть должными)','dovete',NULL,'dovere: devo, devi, deve, dobbiamo, dovete, devono'),
('it','modal','A2','dovere',6,'loro (dovere)','они (быть должными)','devono',NULL,'dovere: devo, devi, deve, dobbiamo, dovete, devono');

-- ===== Множественное число =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','plural','A1','pl',1,'libro → ?','книга → книги','libri',$j$["libri","libre","libra","libo"]$j$,'-o → -i'),
('it','plural','A1','pl',2,'casa → ?','дом → дома','case',$j$["casi","case","casa","casae"]$j$,'-a → -e'),
('it','plural','A1','pl',3,'cane → ?','собака → собаки','cani',$j$["cani","cane","cana","canei"]$j$,'-e → -i'),
('it','plural','A1','pl',4,'chiave → ?','ключ → ключи','chiavi',$j$["chiavi","chiave","chiava","chiavei"]$j$,'-e → -i'),
('it','plural','A2','pl',5,'amico → ?','друг → друзья','amici',$j$["amici","amichi","amico","amice"]$j$,'amico → amici (искл.)'),
('it','plural','A2','pl',6,'amica → ?','подруга → подруги','amiche',$j$["amice","amiche","amichi","amica"]$j$,'-ca → -che (сохраняет звук [к])'),
('it','plural','A2','pl',7,'albergo → ?','отель → отели','alberghi',$j$["alberghi","albergi","alberge","albergo"]$j$,'-go → -ghi'),
('it','plural','A2','pl',8,'problema → ?','проблема → проблемы','problemi',$j$["probleme","problemi","problema","problemà"]$j$,'problema — муж. род → problemi'),
('it','plural','A2','pl',9,'uomo → ?','мужчина → мужчины','uomini',$j$["uomi","uomini","uomos","uomo"]$j$,'uomo → uomini (искл.)'),
('it','plural','A2','pl',10,'città → ?','город → города','città',$j$["città","cittàe","cittài","citte"]$j$,'Слова с ударением на конце не меняются'),
('it','plural','A2','pl',11,'mano → ?','рука → руки','mani',$j$["mani","mane","mano","manos"]$j$,'la mano (ж. род) → le mani'),
('it','plural','A1','pl',12,'figlio → ?','сын → сыновья','figli',$j$["figli","figlii","figlio","figlie"]$j$,'-io → -i');

-- ===== Прилагательные (согласование) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','adjective','A1','adj',1,'la casa ___ (rosso)','красный дом','rossa',$j$["rosso","rossa","rossi","rosse"]$j$,'Ж.р. ед.ч. → -a'),
('it','adjective','A1','adj',2,'il libro ___ (nero)','чёрная книга','nero',$j$["nero","nera","neri","nere"]$j$,'М.р. ед.ч. → -o'),
('it','adjective','A2','adj',3,'le case ___ (bianco)','белые дома','bianche',$j$["bianchi","bianche","bianca","bianco"]$j$,'Ж.р. мн.ч.: bianco → bianche'),
('it','adjective','A1','adj',4,'i cani ___ (piccolo)','маленькие собаки','piccoli',$j$["piccolo","piccola","piccoli","piccole"]$j$,'М.р. мн.ч. → -i'),
('it','adjective','A1','adj',5,'la ragazza ___ (alto)','высокая девушка','alta',$j$["alto","alta","alti","alte"]$j$,'Ж.р. ед.ч. → -a'),
('it','adjective','A1','adj',6,'i ragazzi ___ (italiano)','итальянские парни','italiani',$j$["italiano","italiana","italiani","italiane"]$j$,'М.р. мн.ч. → -i'),
('it','adjective','A2','adj',7,'una macchina ___ (veloce)','быстрая машина','veloce',$j$["veloce","veloci","veloca","veloco"]$j$,'Прилаг. на -e не меняют род: veloce'),
('it','adjective','A2','adj',8,'due macchine ___ (veloce)','две быстрые машины','veloci',$j$["veloce","veloci","veloca","veloce"]$j$,'На -e: мн.ч. → -i'),
('it','adjective','A1','adj',9,'il vestito ___ (verde)','зелёное платье','verde',$j$["verde","verdi","verda","verdo"]$j$,'verde — на -e, ед.ч. не меняется'),
('it','adjective','A1','adj',10,'le scarpe ___ (nuovo)','новые туфли','nuove',$j$["nuovi","nuove","nuova","nuovo"]$j$,'Ж.р. мн.ч. → -e'),
('it','adjective','A2','adj',11,'un uomo ___ (gentile)','вежливый мужчина','gentile',$j$["gentile","gentili","gentila","gentilo"]$j$,'gentile — на -e, ед.ч.'),
('it','adjective','A2','adj',12,'le donne ___ (gentile)','вежливые женщины','gentili',$j$["gentile","gentili","gentilo","gentila"]$j$,'На -e: мн.ч. → -i');

-- ===== Предлоги (слитные) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','preposition','A2','prep',1,'Vado ___ cinema.','Иду в кино','al',$j$["al","nel","del","dal"]$j$,'a + il = al'),
('it','preposition','A2','prep',2,'Il libro ___ studente.','Книга студента','dello',$j$["dello","della","del","dei"]$j$,'di + lo = dello'),
('it','preposition','A2','prep',3,'Abito ___ città.','Живу в городе','nella',$j$["nella","nel","alla","della"]$j$,'in + la = nella'),
('it','preposition','A2','prep',4,'La penna è ___ tavolo.','Ручка на столе','sul',$j$["sul","sulla","nel","del"]$j$,'su + il = sul'),
('it','preposition','A2','prep',5,'Parlo ___ ragazzi.','Говорю с ребятами (ребятам)','ai',$j$["ai","agli","alle","dei"]$j$,'a + i = ai'),
('it','preposition','A2','prep',6,'Il colore ___ macchina.','Цвет машины','della',$j$["della","del","dello","delle"]$j$,'di + la = della'),
('it','preposition','A2','prep',7,'Metto i libri ___ zaino.','Кладу книги в рюкзак','nello',$j$["nello","nel","nella","negli"]$j$,'in + lo = nello'),
('it','preposition','A2','prep',8,'Vado ___ stazione.','Иду на вокзал','alla',$j$["alla","al","allo","alle"]$j$,'a + la = alla'),
('it','preposition','A2','prep',9,'Penso ___ studenti.','Думаю о студентах','agli',$j$["agli","ai","alle","gli"]$j$,'a + gli = agli');

-- ===== Притяжательные (артикль + притяж.) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','possessive','A2','poss',1,'___ libro (мой)','моя книга/мой libro','il mio',$j$["il mio","la mia","i miei","le mie"]$j$,'М.р. ед.ч. → il mio'),
('it','possessive','A2','poss',2,'___ casa (моя)','мой дом','la mia',$j$["il mio","la mia","i miei","le mie"]$j$,'Ж.р. ед.ч. → la mia'),
('it','possessive','A2','poss',3,'___ libri (мои)','мои книги','i miei',$j$["il mio","la mia","i miei","le mie"]$j$,'М.р. мн.ч. → i miei'),
('it','possessive','A2','poss',4,'___ case (мои)','мои дома','le mie',$j$["il mio","la mia","i miei","le mie"]$j$,'Ж.р. мн.ч. → le mie'),
('it','possessive','A2','poss',5,'___ amico (твой)','твой друг','il tuo',$j$["il tuo","la tua","i tuoi","le tue"]$j$,'М.р. ед.ч. → il tuo'),
('it','possessive','A2','poss',6,'___ amica (твоя)','твоя подруга','la tua',$j$["il tuo","la tua","i tuoi","le tue"]$j$,'Ж.р. ед.ч. → la tua'),
('it','possessive','A2','poss',7,'___ cane (его/её)','его/её собака','il suo',$j$["il suo","la sua","i suoi","le sue"]$j$,'suo = и его, и её (по роду предмета)'),
('it','possessive','A2','poss',8,'___ macchina (наша)','наша машина','la nostra',$j$["il nostro","la nostra","i nostri","le nostre"]$j$,'Ж.р. ед.ч. → la nostra'),
('it','possessive','A2','poss',9,'___ amici (наши)','наши друзья','i nostri',$j$["il nostro","la nostra","i nostri","le nostre"]$j$,'М.р. мн.ч. → i nostri'),
('it','possessive','A2','poss',10,'___ libri (ваши)','ваши книги','i vostri',$j$["il vostro","la vostra","i vostri","le vostre"]$j$,'М.р. мн.ч. → i vostri');
