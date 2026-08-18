-- 099_grammar.sql
-- Модуль «Грамматика»: спряжение глаголов + артикли/род. Пока итальянский.

CREATE TABLE IF NOT EXISTS public.grammar_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language    text NOT NULL CHECK (language IN ('en', 'it')),
  kind        text NOT NULL,                 -- 'conjugation' | 'article'
  level       text NOT NULL DEFAULT 'A1',
  topic       text NOT NULL,                 -- глагол (parlare) или группа артиклей
  order_index int  NOT NULL DEFAULT 0,
  prompt      text NOT NULL,                 -- "io (parlare)" / "___ libro"
  prompt_ru   text,
  answer      text NOT NULL,                 -- "parlo" / "il"
  options     jsonb,                         -- если NULL — варианты строятся из той же topic-группы
  explain_ru  text
);
CREATE INDEX IF NOT EXISTS idx_grammar_items_lang_kind ON public.grammar_items(language, kind);

ALTER TABLE public.grammar_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads grammar" ON public.grammar_items;
CREATE POLICY "Anyone reads grammar" ON public.grammar_items FOR SELECT TO authenticated USING (true);

-- Чистим прежний итальянский сид (для идемпотентности)
DELETE FROM public.grammar_items WHERE language = 'it';

-- ============ СПРЯЖЕНИЕ (Presente) ============
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
-- parlare (говорить) — правильный -are
('it','conjugation','A1','parlare',1,'io (parlare)','я (говорить)','parlo',NULL,'Правильный -are: -o, -i, -a, -iamo, -ate, -ano'),
('it','conjugation','A1','parlare',2,'tu (parlare)','ты (говорить)','parli',NULL,'Правильный -are: -o, -i, -a, -iamo, -ate, -ano'),
('it','conjugation','A1','parlare',3,'lui/lei (parlare)','он/она (говорить)','parla',NULL,'Правильный -are: -o, -i, -a, -iamo, -ate, -ano'),
('it','conjugation','A1','parlare',4,'noi (parlare)','мы (говорить)','parliamo',NULL,'Правильный -are: -o, -i, -a, -iamo, -ate, -ano'),
('it','conjugation','A1','parlare',5,'voi (parlare)','вы (говорить)','parlate',NULL,'Правильный -are: -o, -i, -a, -iamo, -ate, -ano'),
('it','conjugation','A1','parlare',6,'loro (parlare)','они (говорить)','parlano',NULL,'Правильный -are: -o, -i, -a, -iamo, -ate, -ano'),
-- lavorare (работать) — правильный -are
('it','conjugation','A1','lavorare',1,'io (lavorare)','я (работать)','lavoro',NULL,'Правильный -are: -o, -i, -a, -iamo, -ate, -ano'),
('it','conjugation','A1','lavorare',2,'tu (lavorare)','ты (работать)','lavori',NULL,'Правильный -are: -o, -i, -a, -iamo, -ate, -ano'),
('it','conjugation','A1','lavorare',3,'lui/lei (lavorare)','он/она (работать)','lavora',NULL,'Правильный -are: -o, -i, -a, -iamo, -ate, -ano'),
('it','conjugation','A1','lavorare',4,'noi (lavorare)','мы (работать)','lavoriamo',NULL,'Правильный -are: -o, -i, -a, -iamo, -ate, -ano'),
('it','conjugation','A1','lavorare',5,'voi (lavorare)','вы (работать)','lavorate',NULL,'Правильный -are: -o, -i, -a, -iamo, -ate, -ano'),
('it','conjugation','A1','lavorare',6,'loro (lavorare)','они (работать)','lavorano',NULL,'Правильный -are: -o, -i, -a, -iamo, -ate, -ano'),
-- prendere (брать) — правильный -ere
('it','conjugation','A1','prendere',1,'io (prendere)','я (брать)','prendo',NULL,'Правильный -ere: -o, -i, -e, -iamo, -ete, -ono'),
('it','conjugation','A1','prendere',2,'tu (prendere)','ты (брать)','prendi',NULL,'Правильный -ere: -o, -i, -e, -iamo, -ete, -ono'),
('it','conjugation','A1','prendere',3,'lui/lei (prendere)','он/она (брать)','prende',NULL,'Правильный -ere: -o, -i, -e, -iamo, -ete, -ono'),
('it','conjugation','A1','prendere',4,'noi (prendere)','мы (брать)','prendiamo',NULL,'Правильный -ere: -o, -i, -e, -iamo, -ete, -ono'),
('it','conjugation','A1','prendere',5,'voi (prendere)','вы (брать)','prendete',NULL,'Правильный -ere: -o, -i, -e, -iamo, -ete, -ono'),
('it','conjugation','A1','prendere',6,'loro (prendere)','они (брать)','prendono',NULL,'Правильный -ere: -o, -i, -e, -iamo, -ete, -ono'),
-- leggere (читать) — правильный -ere
('it','conjugation','A1','leggere',1,'io (leggere)','я (читать)','leggo',NULL,'Правильный -ere: -o, -i, -e, -iamo, -ete, -ono'),
('it','conjugation','A1','leggere',2,'tu (leggere)','ты (читать)','leggi',NULL,'Правильный -ere: -o, -i, -e, -iamo, -ete, -ono'),
('it','conjugation','A1','leggere',3,'lui/lei (leggere)','он/она (читать)','legge',NULL,'Правильный -ere: -o, -i, -e, -iamo, -ete, -ono'),
('it','conjugation','A1','leggere',4,'noi (leggere)','мы (читать)','leggiamo',NULL,'Правильный -ere: -o, -i, -e, -iamo, -ete, -ono'),
('it','conjugation','A1','leggere',5,'voi (leggere)','вы (читать)','leggete',NULL,'Правильный -ere: -o, -i, -e, -iamo, -ete, -ono'),
('it','conjugation','A1','leggere',6,'loro (leggere)','они (читать)','leggono',NULL,'Правильный -ere: -o, -i, -e, -iamo, -ete, -ono'),
-- dormire (спать) — правильный -ire
('it','conjugation','A1','dormire',1,'io (dormire)','я (спать)','dormo',NULL,'Правильный -ire: -o, -i, -e, -iamo, -ite, -ono'),
('it','conjugation','A1','dormire',2,'tu (dormire)','ты (спать)','dormi',NULL,'Правильный -ire: -o, -i, -e, -iamo, -ite, -ono'),
('it','conjugation','A1','dormire',3,'lui/lei (dormire)','он/она (спать)','dorme',NULL,'Правильный -ire: -o, -i, -e, -iamo, -ite, -ono'),
('it','conjugation','A1','dormire',4,'noi (dormire)','мы (спать)','dormiamo',NULL,'Правильный -ire: -o, -i, -e, -iamo, -ite, -ono'),
('it','conjugation','A1','dormire',5,'voi (dormire)','вы (спать)','dormite',NULL,'Правильный -ire: -o, -i, -e, -iamo, -ite, -ono'),
('it','conjugation','A1','dormire',6,'loro (dormire)','они (спать)','dormono',NULL,'Правильный -ire: -o, -i, -e, -iamo, -ite, -ono'),
-- capire (понимать) — тип -isco
('it','conjugation','A1','capire',1,'io (capire)','я (понимать)','capisco',NULL,'Тип -isco: capisco, capisci, capisce, capiamo, capite, capiscono'),
('it','conjugation','A1','capire',2,'tu (capire)','ты (понимать)','capisci',NULL,'Тип -isco: capisco, capisci, capisce, capiamo, capite, capiscono'),
('it','conjugation','A1','capire',3,'lui/lei (capire)','он/она (понимать)','capisce',NULL,'Тип -isco: capisco, capisci, capisce, capiamo, capite, capiscono'),
('it','conjugation','A1','capire',4,'noi (capire)','мы (понимать)','capiamo',NULL,'Тип -isco: capisco, capisci, capisce, capiamo, capite, capiscono'),
('it','conjugation','A1','capire',5,'voi (capire)','вы (понимать)','capite',NULL,'Тип -isco: capisco, capisci, capisce, capiamo, capite, capiscono'),
('it','conjugation','A1','capire',6,'loro (capire)','они (понимать)','capiscono',NULL,'Тип -isco: capisco, capisci, capisce, capiamo, capite, capiscono'),
-- essere (быть) — неправильный
('it','conjugation','A1','essere',1,'io (essere)','я (быть)','sono',NULL,'essere (быть): sono, sei, è, siamo, siete, sono'),
('it','conjugation','A1','essere',2,'tu (essere)','ты (быть)','sei',NULL,'essere (быть): sono, sei, è, siamo, siete, sono'),
('it','conjugation','A1','essere',3,'lui/lei (essere)','он/она (быть)','è',NULL,'essere (быть): sono, sei, è, siamo, siete, sono'),
('it','conjugation','A1','essere',4,'noi (essere)','мы (быть)','siamo',NULL,'essere (быть): sono, sei, è, siamo, siete, sono'),
('it','conjugation','A1','essere',5,'voi (essere)','вы (быть)','siete',NULL,'essere (быть): sono, sei, è, siamo, siete, sono'),
('it','conjugation','A1','essere',6,'loro (essere)','они (быть)','sono',NULL,'essere (быть): sono, sei, è, siamo, siete, sono'),
-- avere (иметь) — неправильный
('it','conjugation','A1','avere',1,'io (avere)','я (иметь)','ho',NULL,'avere (иметь): ho, hai, ha, abbiamo, avete, hanno'),
('it','conjugation','A1','avere',2,'tu (avere)','ты (иметь)','hai',NULL,'avere (иметь): ho, hai, ha, abbiamo, avete, hanno'),
('it','conjugation','A1','avere',3,'lui/lei (avere)','он/она (иметь)','ha',NULL,'avere (иметь): ho, hai, ha, abbiamo, avete, hanno'),
('it','conjugation','A1','avere',4,'noi (avere)','мы (иметь)','abbiamo',NULL,'avere (иметь): ho, hai, ha, abbiamo, avete, hanno'),
('it','conjugation','A1','avere',5,'voi (avere)','вы (иметь)','avete',NULL,'avere (иметь): ho, hai, ha, abbiamo, avete, hanno'),
('it','conjugation','A1','avere',6,'loro (avere)','они (иметь)','hanno',NULL,'avere (иметь): ho, hai, ha, abbiamo, avete, hanno'),
-- fare (делать) — неправильный
('it','conjugation','A1','fare',1,'io (fare)','я (делать)','faccio',NULL,'fare (делать): faccio, fai, fa, facciamo, fate, fanno'),
('it','conjugation','A1','fare',2,'tu (fare)','ты (делать)','fai',NULL,'fare (делать): faccio, fai, fa, facciamo, fate, fanno'),
('it','conjugation','A1','fare',3,'lui/lei (fare)','он/она (делать)','fa',NULL,'fare (делать): faccio, fai, fa, facciamo, fate, fanno'),
('it','conjugation','A1','fare',4,'noi (fare)','мы (делать)','facciamo',NULL,'fare (делать): faccio, fai, fa, facciamo, fate, fanno'),
('it','conjugation','A1','fare',5,'voi (fare)','вы (делать)','fate',NULL,'fare (делать): faccio, fai, fa, facciamo, fate, fanno'),
('it','conjugation','A1','fare',6,'loro (fare)','они (делать)','fanno',NULL,'fare (делать): faccio, fai, fa, facciamo, fate, fanno'),
-- andare (идти/ехать) — неправильный
('it','conjugation','A1','andare',1,'io (andare)','я (идти)','vado',NULL,'andare (идти): vado, vai, va, andiamo, andate, vanno'),
('it','conjugation','A1','andare',2,'tu (andare)','ты (идти)','vai',NULL,'andare (идти): vado, vai, va, andiamo, andate, vanno'),
('it','conjugation','A1','andare',3,'lui/lei (andare)','он/она (идти)','va',NULL,'andare (идти): vado, vai, va, andiamo, andate, vanno'),
('it','conjugation','A1','andare',4,'noi (andare)','мы (идти)','andiamo',NULL,'andare (идти): vado, vai, va, andiamo, andate, vanno'),
('it','conjugation','A1','andare',5,'voi (andare)','вы (идти)','andate',NULL,'andare (идти): vado, vai, va, andiamo, andate, vanno'),
('it','conjugation','A1','andare',6,'loro (andare)','они (идти)','vanno',NULL,'andare (идти): vado, vai, va, andiamo, andate, vanno');

-- ============ АРТИКЛИ ============
-- Определённый артикль (il / lo / la / l')
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('it','article','A1','definite',1,'___ libro','книга (м.р.)','il',$j$["il","lo","la","l'"]$j$::jsonb,'Муж. род перед согласной → il'),
('it','article','A1','definite',2,'___ cane','собака (м.р.)','il',$j$["il","lo","la","l'"]$j$::jsonb,'Муж. род перед согласной → il'),
('it','article','A1','definite',3,'___ tavolo','стол (м.р.)','il',$j$["il","lo","la","l'"]$j$::jsonb,'Муж. род перед согласной → il'),
('it','article','A1','definite',4,'___ ragazzo','парень (м.р.)','il',$j$["il","lo","la","l'"]$j$::jsonb,'Муж. род перед согласной → il'),
('it','article','A1','definite',5,'___ studente','студент (м.р.)','lo',$j$["il","lo","la","l'"]$j$::jsonb,'Муж. род перед s+согласная → lo'),
('it','article','A1','definite',6,'___ zaino','рюкзак (м.р.)','lo',$j$["il","lo","la","l'"]$j$::jsonb,'Муж. род перед z → lo'),
('it','article','A1','definite',7,'___ zio','дядя (м.р.)','lo',$j$["il","lo","la","l'"]$j$::jsonb,'Муж. род перед z → lo'),
('it','article','A1','definite',8,'___ specchio','зеркало (м.р.)','lo',$j$["il","lo","la","l'"]$j$::jsonb,'Муж. род перед s+согласная → lo'),
('it','article','A1','definite',9,'___ amico','друг (м.р.)','l''',$j$["il","lo","la","l'"]$j$::jsonb,'Перед гласной → l'''),
('it','article','A1','definite',10,'___ albero','дерево (м.р.)','l''',$j$["il","lo","la","l'"]$j$::jsonb,'Перед гласной → l'''),
('it','article','A1','definite',11,'___ casa','дом (ж.р.)','la',$j$["il","lo","la","l'"]$j$::jsonb,'Жен. род перед согласной → la'),
('it','article','A1','definite',12,'___ donna','женщина (ж.р.)','la',$j$["il","lo","la","l'"]$j$::jsonb,'Жен. род перед согласной → la'),
('it','article','A1','definite',13,'___ macchina','машина (ж.р.)','la',$j$["il","lo","la","l'"]$j$::jsonb,'Жен. род перед согласной → la'),
('it','article','A1','definite',14,'___ scuola','школа (ж.р.)','la',$j$["il","lo","la","l'"]$j$::jsonb,'Жен. род перед согласной → la'),
('it','article','A1','definite',15,'___ ora','час (ж.р.)','l''',$j$["il","lo","la","l'"]$j$::jsonb,'Жен. род перед гласной → l'''),
-- Неопределённый артикль (un / uno / una / un')
('it','article','A1','indefinite',1,'___ libro','книга (м.р.)','un',$j$["un","uno","una","un'"]$j$::jsonb,'Муж. род → un'),
('it','article','A1','indefinite',2,'___ cane','собака (м.р.)','un',$j$["un","uno","una","un'"]$j$::jsonb,'Муж. род → un'),
('it','article','A1','indefinite',3,'___ amico','друг (м.р.)','un',$j$["un","uno","una","un'"]$j$::jsonb,'Муж. род перед гласной → un (без апострофа)'),
('it','article','A1','indefinite',4,'___ studente','студент (м.р.)','uno',$j$["un","uno","una","un'"]$j$::jsonb,'Муж. род перед s+согласная → uno'),
('it','article','A1','indefinite',5,'___ zaino','рюкзак (м.р.)','uno',$j$["un","uno","una","un'"]$j$::jsonb,'Муж. род перед z → uno'),
('it','article','A1','indefinite',6,'___ zio','дядя (м.р.)','uno',$j$["un","uno","una","un'"]$j$::jsonb,'Муж. род перед z → uno'),
('it','article','A1','indefinite',7,'___ casa','дом (ж.р.)','una',$j$["un","uno","una","un'"]$j$::jsonb,'Жен. род перед согласной → una'),
('it','article','A1','indefinite',8,'___ donna','женщина (ж.р.)','una',$j$["un","uno","una","un'"]$j$::jsonb,'Жен. род перед согласной → una'),
('it','article','A1','indefinite',9,'___ scuola','школа (ж.р.)','una',$j$["un","uno","una","un'"]$j$::jsonb,'Жен. род перед согласной → una'),
('it','article','A1','indefinite',10,'___ amica','подруга (ж.р.)','un''',$j$["un","uno","una","un'"]$j$::jsonb,'Жен. род перед гласной → un'''),
('it','article','A1','indefinite',11,'___ ora','час (ж.р.)','un''',$j$["un","uno","una","un'"]$j$::jsonb,'Жен. род перед гласной → un''');
