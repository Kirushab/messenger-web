-- ============================================================
-- 157_grammar_es_futuro_plural_prep.sql
-- Бэклог по языкам #4: грамматика испанского — будущее (futuro),
-- множественное число, предлоги. Новые kind для 'es'.
-- Идемпотентно: перед вставкой удаляем эти (language, kind).
-- options=NULL → варианты строятся из ответов той же topic-группы.
-- ============================================================

DELETE FROM public.grammar_items WHERE language='es' AND kind IN ('futuro','plural','preposition');

-- ===== ES · futuro (A2) — инфинитив + é/ás/á/emos/éis/án (одинаково для -ar/-er/-ir) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('es','futuro','A2','hablar',1,'yo (hablar)','я (говорить)','hablaré',NULL,'Futuro: инфинитив + é/ás/á/emos/éis/án'),
('es','futuro','A2','hablar',2,'tú (hablar)','ты (говорить)','hablarás',NULL,'Futuro: инфинитив + é/ás/á/emos/éis/án'),
('es','futuro','A2','hablar',3,'él/ella (hablar)','он/она (говорить)','hablará',NULL,'Futuro: инфинитив + é/ás/á/emos/éis/án'),
('es','futuro','A2','hablar',4,'nosotros (hablar)','мы (говорить)','hablaremos',NULL,'Futuro: инфинитив + é/ás/á/emos/éis/án'),
('es','futuro','A2','hablar',5,'vosotros (hablar)','вы (говорить)','hablaréis',NULL,'Futuro: инфинитив + é/ás/á/emos/éis/án'),
('es','futuro','A2','hablar',6,'ellos (hablar)','они (говорить)','hablarán',NULL,'Futuro: инфинитив + é/ás/á/emos/éis/án'),
('es','futuro','A2','comer',1,'yo (comer)','я (есть)','comeré',NULL,'Futuro одинаков для всех групп: + é/ás/á/emos/éis/án'),
('es','futuro','A2','comer',2,'tú (comer)','ты (есть)','comerás',NULL,'Futuro одинаков для всех групп: + é/ás/á/emos/éis/án'),
('es','futuro','A2','comer',3,'él/ella (comer)','он/она (есть)','comerá',NULL,'Futuro одинаков для всех групп: + é/ás/á/emos/éis/án'),
('es','futuro','A2','comer',4,'nosotros (comer)','мы (есть)','comeremos',NULL,'Futuro одинаков для всех групп: + é/ás/á/emos/éis/án'),
('es','futuro','A2','comer',5,'vosotros (comer)','вы (есть)','comeréis',NULL,'Futuro одинаков для всех групп: + é/ás/á/emos/éis/án'),
('es','futuro','A2','comer',6,'ellos (comer)','они (есть)','comerán',NULL,'Futuro одинаков для всех групп: + é/ás/á/emos/éis/án');

-- ===== ES · plural (A1) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('es','plural','A1','plural',1,'libro','книга → мн.','libros',NULL,'После гласной добавляем -s'),
('es','plural','A1','plural',2,'casa','дом → мн.','casas',NULL,'После гласной добавляем -s'),
('es','plural','A1','plural',3,'coche','машина → мн.','coches',NULL,'После гласной добавляем -s'),
('es','plural','A1','plural',4,'papel','бумага → мн.','papeles',NULL,'После согласной добавляем -es'),
('es','plural','A1','plural',5,'profesor','преподаватель → мн.','profesores',NULL,'После согласной добавляем -es'),
('es','plural','A1','plural',6,'ciudad','город → мн.','ciudades',NULL,'После согласной добавляем -es'),
('es','plural','A1','plural',7,'luz','свет → мн.','luces',NULL,'z → c перед -es: luz → luces'),
('es','plural','A1','plural',8,'lápiz','карандаш → мн.','lápices',NULL,'z → c перед -es: lápiz → lápices');

-- ===== ES · preposition (A1) =====
INSERT INTO public.grammar_items (language, kind, level, topic, order_index, prompt, prompt_ru, answer, options, explain_ru) VALUES
('es','preposition','A1','preposition',1,'Vivo ___ Madrid.','Я живу в Мадриде.','en',NULL,'en — в/на (местоположение)'),
('es','preposition','A1','preposition',2,'Voy ___ la escuela.','Я иду в школу.','a',NULL,'a — к/в (направление)'),
('es','preposition','A1','preposition',3,'El libro ___ Ana.','Книга Аны.','de',NULL,'de — принадлежность/из'),
('es','preposition','A1','preposition',4,'Café ___ leche.','Кофе с молоком.','con',NULL,'con — с (вместе)'),
('es','preposition','A1','preposition',5,'Gracias ___ todo.','Спасибо за всё.','por',NULL,'por — за/из-за (причина)'),
('es','preposition','A1','preposition',6,'Un regalo ___ ti.','Подарок для тебя.','para',NULL,'para — для/чтобы (цель/адресат)');
