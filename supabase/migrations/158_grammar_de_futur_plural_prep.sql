-- ============================================================
-- 158_grammar_de_futur_plural_prep.sql
-- Бэклог по языкам #4: грамматика немецкого — будущее (Futur I с werden),
-- множественное число, предлоги. Новые kind для 'de'.
-- Идемпотентно: перед вставкой удаляем эти (language, kind).
-- options=NULL → варианты строятся из ответов той же topic-группы.
-- ============================================================

DELETE FROM public.grammar_items WHERE language='de' AND kind IN ('futuro','plural','preposition');

-- ===== DE · futuro (A2) — Futur I: спрягаем werden + инфинитив в конце =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('de','futuro','A2','werden',1,'ich ___ spielen','я буду играть','werde',NULL,'Futur I = werden + Infinitiv. ich werde'),
('de','futuro','A2','werden',2,'du ___ spielen','ты будешь играть','wirst',NULL,'Futur I = werden + Infinitiv. du wirst'),
('de','futuro','A2','werden',3,'er ___ spielen','он будет играть','wird',NULL,'Futur I = werden + Infinitiv. er/sie/es wird'),
('de','futuro','A2','werden',4,'wir ___ spielen','мы будем играть','werden',NULL,'Futur I = werden + Infinitiv. wir werden'),
('de','futuro','A2','werden',5,'ihr ___ spielen','вы будете играть','werdet',NULL,'Futur I = werden + Infinitiv. ihr werdet'),
('de','futuro','A2','werden',6,'sie ___ spielen','они будут играть','werden',NULL,'Futur I = werden + Infinitiv. sie/Sie werden');

-- ===== DE · plural (A1) — множественное число =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('de','plural','A1','plural',1,'das Kind','ребёнок → мн.','Kinder',NULL,'-er: das Kind → die Kinder'),
('de','plural','A1','plural',2,'der Tisch','стол → мн.','Tische',NULL,'-e: der Tisch → die Tische'),
('de','plural','A1','plural',3,'die Frau','женщина → мн.','Frauen',NULL,'-en: die Frau → die Frauen'),
('de','plural','A1','plural',4,'das Auto','машина → мн.','Autos',NULL,'-s (заимствования): das Auto → die Autos'),
('de','plural','A1','plural',5,'der Apfel','яблоко → мн.','Äpfel',NULL,'умлаут без окончания: der Apfel → die Äpfel'),
('de','plural','A1','plural',6,'der Mann','мужчина → мн.','Männer',NULL,'умлаут + -er: der Mann → die Männer'),
('de','plural','A1','plural',7,'das Buch','книга → мн.','Bücher',NULL,'умлаут + -er: das Buch → die Bücher'),
('de','plural','A1','plural',8,'der Hund','собака → мн.','Hunde',NULL,'-e: der Hund → die Hunde');

-- ===== DE · preposition (A1) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('de','preposition','A1','preposition',1,'Ich wohne ___ Berlin.','Я живу в Берлине.','in',NULL,'in — в (местоположение)'),
('de','preposition','A1','preposition',2,'Das Buch ist ___ dem Tisch.','Книга на столе.','auf',NULL,'auf — на (поверхность)'),
('de','preposition','A1','preposition',3,'Ich komme ___ Russland.','Я из России.','aus',NULL,'aus — из (происхождение)'),
('de','preposition','A1','preposition',4,'Ein Geschenk ___ dich.','Подарок для тебя.','für',NULL,'für — для (+ винительный)'),
('de','preposition','A1','preposition',5,'Ich fahre ___ dem Bus.','Я еду на автобусе.','mit',NULL,'mit — с/на (средство, + дательный)'),
('de','preposition','A1','preposition',6,'Ich bin ___ Hause.','Я дома.','zu',NULL,'zu Hause — дома (устойчивое выражение)');
