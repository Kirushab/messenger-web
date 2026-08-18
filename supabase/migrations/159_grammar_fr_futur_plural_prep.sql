-- ============================================================
-- 159_grammar_fr_futur_plural_prep.sql
-- Бэклог по языкам #4: грамматика французского — будущее (futur simple),
-- множественное число, предлоги. Новые kind для 'fr'.
-- Идемпотентно: перед вставкой удаляем эти (language, kind).
-- options=NULL → варианты строятся из ответов той же topic-группы.
-- ============================================================

DELETE FROM public.grammar_items WHERE language='fr' AND kind IN ('futuro','plural','preposition');

-- ===== FR · futuro (A2) — futur simple: инфинитив + ai/as/a/ons/ez/ont =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('fr','futuro','A2','parler',1,'je (parler)','я (говорить)','parlerai',NULL,'Futur simple: инфинитив + ai/as/a/ons/ez/ont'),
('fr','futuro','A2','parler',2,'tu (parler)','ты (говорить)','parleras',NULL,'Futur simple: инфинитив + ai/as/a/ons/ez/ont'),
('fr','futuro','A2','parler',3,'il/elle (parler)','он/она (говорить)','parlera',NULL,'Futur simple: инфинитив + ai/as/a/ons/ez/ont'),
('fr','futuro','A2','parler',4,'nous (parler)','мы (говорить)','parlerons',NULL,'Futur simple: инфинитив + ai/as/a/ons/ez/ont'),
('fr','futuro','A2','parler',5,'vous (parler)','вы (говорить)','parlerez',NULL,'Futur simple: инфинитив + ai/as/a/ons/ez/ont'),
('fr','futuro','A2','parler',6,'ils (parler)','они (говорить)','parleront',NULL,'Futur simple: инфинитив + ai/as/a/ons/ez/ont'),
('fr','futuro','A2','finir',1,'je (finir)','я (заканчивать)','finirai',NULL,'Futur simple для -ir: инфинитив + ai/as/a/ons/ez/ont'),
('fr','futuro','A2','finir',2,'tu (finir)','ты (заканчивать)','finiras',NULL,'Futur simple для -ir: инфинитив + ai/as/a/ons/ez/ont'),
('fr','futuro','A2','finir',3,'il/elle (finir)','он/она (заканчивать)','finira',NULL,'Futur simple для -ir: инфинитив + ai/as/a/ons/ez/ont'),
('fr','futuro','A2','finir',4,'nous (finir)','мы (заканчивать)','finirons',NULL,'Futur simple для -ir: инфинитив + ai/as/a/ons/ez/ont'),
('fr','futuro','A2','finir',5,'vous (finir)','вы (заканчивать)','finirez',NULL,'Futur simple для -ir: инфинитив + ai/as/a/ons/ez/ont'),
('fr','futuro','A2','finir',6,'ils (finir)','они (заканчивать)','finiront',NULL,'Futur simple для -ir: инфинитив + ai/as/a/ons/ez/ont');

-- ===== FR · plural (A1) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('fr','plural','A1','plural',1,'le livre','книга → мн.','livres',NULL,'Обычно +s: le livre → les livres'),
('fr','plural','A1','plural',2,'la table','стол → мн.','tables',NULL,'Обычно +s: la table → les tables'),
('fr','plural','A1','plural',3,'l''ami','друг → мн.','amis',NULL,'Обычно +s: l''ami → les amis'),
('fr','plural','A1','plural',4,'le château','замок → мн.','châteaux',NULL,'-eau → -eaux: le château → les châteaux'),
('fr','plural','A1','plural',5,'le gâteau','торт → мн.','gâteaux',NULL,'-eau → -eaux: le gâteau → les gâteaux'),
('fr','plural','A1','plural',6,'l''animal','животное → мн.','animaux',NULL,'-al → -aux: l''animal → les animaux'),
('fr','plural','A1','plural',7,'le journal','газета → мн.','journaux',NULL,'-al → -aux: le journal → les journaux'),
('fr','plural','A1','plural',8,'le cheval','лошадь → мн.','chevaux',NULL,'-al → -aux: le cheval → les chevaux');

-- ===== FR · preposition (A1) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('fr','preposition','A1','preposition',1,'J''habite ___ Paris.','Я живу в Париже.','à',NULL,'à — в (город)'),
('fr','preposition','A1','preposition',2,'Le livre ___ Marie.','Книга Мари.','de',NULL,'de — принадлежность/из'),
('fr','preposition','A1','preposition',3,'Un cadeau ___ toi.','Подарок для тебя.','pour',NULL,'pour — для'),
('fr','preposition','A1','preposition',4,'Je voyage ___ train.','Я еду на поезде.','en',NULL,'en — на (транспорт)'),
('fr','preposition','A1','preposition',5,'Le chat est ___ la table.','Кот на столе.','sur',NULL,'sur — на (поверхность)'),
('fr','preposition','A1','preposition',6,'Je vais ___ Pierre.','Я иду к Пьеру.','chez',NULL,'chez — к (кому-то домой)');
