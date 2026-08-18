-- 150_grammar_conjugations_es_de_fr.sql
-- №6: больше глаголов (настоящее) + прошедшее (es pretérito, de Perfekt, fr passé composé).
-- Идемпотентно: удаляет ТОЛЬКО свою область (kind='past' + новые present-топики) у es/de/fr. Запускать после 149.
ALTER TABLE public.grammar_items DROP CONSTRAINT IF EXISTS grammar_items_language_check;
ALTER TABLE public.grammar_items ADD  CONSTRAINT grammar_items_language_check CHECK (language IN ('en','it','es','de','fr'));
DELETE FROM public.grammar_items WHERE language IN ('es','de','fr') AND ( kind = 'past' OR topic IN ('ir', 'estar', 'comer', 'vivir', 'aller', 'faire', 'finir', 'gehen', 'kommen', 'essen') );

INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('es','conjugation','A1','ir',51,'yo ___ al trabajo','я иду на работу','voy','["voy", "vas", "va"]','ir: voy, vas, va, vamos, vais, van'),
('es','conjugation','A1','ir',52,'tú ___ a casa','ты идёшь домой','vas','["voy", "vas", "va"]','ir: voy, vas, va, vamos, vais, van'),
('es','conjugation','A1','ir',53,'nosotros ___ al cine','мы идём в кино','vamos','["vamos", "vais", "van"]','ir: voy, vas, va, vamos, vais, van'),
('es','conjugation','A1','estar',54,'yo ___ en casa','я дома','estoy','["estoy", "estás", "está"]','estar: estoy, estás, está, estamos, estáis, están'),
('es','conjugation','A1','estar',55,'ella ___ cansada','она устала','está','["estoy", "estás", "está"]','estar: estoy, estás, está, estamos, estáis, están'),
('es','conjugation','A2','comer',56,'yo ___ pan','я ем хлеб','como','["como", "comes", "come"]','-er: -o, -es, -e, -emos, -éis, -en'),
('es','conjugation','A2','comer',57,'tú ___ fruta','ты ешь фрукты','comes','["como", "comes", "come"]','-er: -o, -es, -e, -emos, -éis, -en'),
('es','conjugation','A2','vivir',58,'yo ___ en Madrid','я живу в Мадриде','vivo','["vivo", "vives", "vive"]','-ir: -o, -es, -e, -imos, -ís, -en'),
('es','conjugation','A2','vivir',59,'ellos ___ aquí','они живут здесь','viven','["vivo", "vives", "viven"]','-ir: -o, -es, -e, -imos, -ís, -en'),
('es','past','A2','preterito',60,'ayer yo ___ español (hablar)','вчера я говорил по-испански','hablé','["hablé", "hablo", "hablaré"]','pretérito indefinido: вчера / законченное действие'),
('es','past','A2','preterito',61,'él ___ una carta (escribir)','он написал письмо','escribió','["escribió", "escribe", "escribirá"]','pretérito indefinido: вчера / законченное действие'),
('es','past','A2','preterito',62,'nosotros ___ pizza (comer)','мы ели пиццу','comimos','["comimos", "comemos", "comeremos"]','pretérito indefinido: вчера / законченное действие'),
('es','past','A2','preterito',63,'ellos ___ a casa (ir)','они пошли домой','fueron','["fueron", "van", "irán"]','ir/ser в pretérito: fui, fuiste, fue, fuimos, fuisteis, fueron'),
('es','past','A2','preterito',64,'yo ___ un libro (leer)','я прочитал книгу','leí','["leí", "leo", "leeré"]','pretérito indefinido: вчера / законченное действие'),
('es','past','A2','preterito',65,'tú ___ la tele (ver)','ты смотрел телевизор','viste','["viste", "ves", "verás"]','pretérito indefinido: вчера / законченное действие'),
('fr','conjugation','A1','aller',51,'je ___ au travail','я иду на работу','vais','["vais", "vas", "va"]','aller: vais, vas, va, allons, allez, vont'),
('fr','conjugation','A1','aller',52,'tu ___ à la maison','ты идёшь домой','vas','["vais", "vas", "va"]','aller: vais, vas, va, allons, allez, vont'),
('fr','conjugation','A1','aller',53,'nous ___ au cinéma','мы идём в кино','allons','["allons", "allez", "vont"]','aller: vais, vas, va, allons, allez, vont'),
('fr','conjugation','A1','faire',54,'je ___ mes devoirs','я делаю уроки','fais','["fais", "fait", "faisons"]','faire: fais, fais, fait, faisons, faites, font'),
('fr','conjugation','A1','faire',55,'il ___ du sport','он занимается спортом','fait','["fais", "fait", "font"]','faire: fais, fais, fait, faisons, faites, font'),
('fr','conjugation','A2','finir',56,'je ___ le travail','я заканчиваю работу','finis','["finis", "finit", "finissons"]','-ir: -is, -is, -it, -issons, -issez, -issent'),
('fr','conjugation','A2','finir',57,'nous ___ tôt','мы заканчиваем рано','finissons','["finis", "finit", "finissons"]','-ir: -is, -is, -it, -issons, -issez, -issent'),
('fr','past','A2','passe_compose',58,'j''___ mangé (manger)','я поел','ai','["ai", "suis", "as"]','passé composé: avoir/être + participe passé. Большинство глаголов → avoir'),
('fr','past','A2','passe_compose',59,'tu ___ parlé (parler)','ты говорил','as','["as", "es", "ai"]','passé composé: avoir/être + participe passé'),
('fr','past','A2','passe_compose',60,'il ___ fini (finir)','он закончил','a','["a", "est", "ont"]','passé composé: avoir/être + participe passé'),
('fr','past','A2','passe_compose',61,'je ___ allé(e) (aller)','я пошёл/пошла','suis','["suis", "ai", "es"]','Глаголы движения (aller, venir…) → être'),
('fr','past','A2','passe_compose',62,'elle ___ venue (venir)','она пришла','est','["est", "a", "ont"]','venir → être (+ согласование: venue)'),
('fr','past','A2','passe_compose',63,'nous ___ vu le film (voir)','мы посмотрели фильм','avons','["avons", "sommes", "ont"]','passé composé: avoir/être + participe passé'),
('de','conjugation','A1','gehen',51,'ich ___ nach Hause','я иду домой','gehe','["gehe", "gehst", "geht"]','gehen: gehe, gehst, geht, gehen, geht, gehen'),
('de','conjugation','A1','gehen',52,'du ___ zur Arbeit','ты идёшь на работу','gehst','["gehe", "gehst", "geht"]','gehen: gehe, gehst, geht, gehen, geht, gehen'),
('de','conjugation','A1','gehen',53,'wir ___ ins Kino','мы идём в кино','gehen','["gehe", "gehst", "gehen"]','gehen: gehe, gehst, geht, gehen, geht, gehen'),
('de','conjugation','A1','kommen',54,'ich ___ aus Russland','я из России','komme','["komme", "kommst", "kommt"]','kommen: komme, kommst, kommt, kommen, kommt, kommen'),
('de','conjugation','A1','kommen',55,'er ___ zu spät','он опаздывает','kommt','["komme", "kommst", "kommt"]','kommen: komme, kommst, kommt, kommen, kommt, kommen'),
('de','conjugation','A2','essen',56,'ich ___ Brot','я ем хлеб','esse','["esse", "isst", "essen"]','essen (e→i): esse, isst, isst, essen, esst, essen'),
('de','conjugation','A2','essen',57,'du ___ Fleisch','ты ешь мясо','isst','["esse", "isst", "essen"]','essen (e→i): esse, isst, isst, essen, esst, essen'),
('de','past','A2','perfekt',58,'ich ___ Deutsch gelernt (lernen)','я учил немецкий','habe','["habe", "bin", "hat"]','Perfekt: haben/sein + Partizip II. Большинство → haben'),
('de','past','A2','perfekt',59,'du ___ gegessen (essen)','ты поел','hast','["hast", "bist", "habe"]','Perfekt: haben/sein + Partizip II'),
('de','past','A2','perfekt',60,'er ___ gekommen (kommen)','он пришёл','ist','["ist", "hat", "sind"]','Глаголы движения → sein (kommen → ist gekommen)'),
('de','past','A2','perfekt',61,'wir ___ gefahren (fahren)','мы поехали','sind','["sind", "haben", "seid"]','fahren → sein (движение)'),
('de','past','A2','perfekt',62,'sie ___ gesprochen (sprechen)','она говорила','hat','["hat", "ist", "haben"]','Perfekt: haben/sein + Partizip II'),
('de','past','A2','perfekt',63,'ich ___ gegangen (gehen)','я пошёл','bin','["bin", "habe", "ist"]','gehen → sein');
