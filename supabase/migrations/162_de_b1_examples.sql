-- ============================================================
-- 162_de_b1_examples.sql
-- Бэклог по языкам #6: примеры к сложным словам B1 — немецкий,
-- темы «Технологии», «Здоровье», «Характер» (у них был NULL example).
-- Идемпотентно: UPDATE по language+level+word, dollar-quoting ($e$/$r$/$w$).
-- ============================================================

-- ===== DE B1 · technology =====
UPDATE public.language_words lw SET example=$e$Die Technik wird immer besser.$e$, example_ru=$r$Техника становится всё лучше.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$die Technik$w$;
UPDATE public.language_words lw SET example=$e$Mein Computer ist neu.$e$, example_ru=$r$Мой компьютер новый.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$der Computer$w$;
UPDATE public.language_words lw SET example=$e$Ich habe kein Internet zu Hause.$e$, example_ru=$r$У меня нет интернета дома.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$das Internet$w$;
UPDATE public.language_words lw SET example=$e$Ich schreibe dir eine E-Mail.$e$, example_ru=$r$Я напишу тебе электронное письмо.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$die E-Mail$w$;
UPDATE public.language_words lw SET example=$e$Ich habe mein Passwort vergessen.$e$, example_ru=$r$Я забыл свой пароль.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$das Passwort$w$;
UPDATE public.language_words lw SET example=$e$Der Bildschirm ist sehr groß.$e$, example_ru=$r$Экран очень большой.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$der Bildschirm$w$;
UPDATE public.language_words lw SET example=$e$Bitte speichere die Datei.$e$, example_ru=$r$Пожалуйста, сохрани файл.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$die Datei$w$;
UPDATE public.language_words lw SET example=$e$Diese App ist sehr nützlich.$e$, example_ru=$r$Это приложение очень полезное.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$die App$w$;
UPDATE public.language_words lw SET example=$e$Das Netzwerk funktioniert nicht.$e$, example_ru=$r$Сеть не работает.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$das Netzwerk$w$;
UPDATE public.language_words lw SET example=$e$Ich möchte den Film herunterladen.$e$, example_ru=$r$Я хочу скачать фильм.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$herunterladen$w$;
UPDATE public.language_words lw SET example=$e$Ich habe dir eine Nachricht geschickt.$e$, example_ru=$r$Я отправил тебе сообщение.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$die Nachricht$w$;
UPDATE public.language_words lw SET example=$e$Die Kamera ist sehr gut.$e$, example_ru=$r$Камера очень хорошая.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$die Kamera$w$;
UPDATE public.language_words lw SET example=$e$Gib deinen Benutzernamen ein.$e$, example_ru=$r$Введи своё имя пользователя.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$der Benutzer$w$;

-- ===== DE B1 · health =====
UPDATE public.language_words lw SET example=$e$Gesundheit ist das Wichtigste.$e$, example_ru=$r$Здоровье — самое важное.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$die Gesundheit$w$;
UPDATE public.language_words lw SET example=$e$Das ist eine häufige Krankheit.$e$, example_ru=$r$Это распространённая болезнь.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$die Krankheit$w$;
UPDATE public.language_words lw SET example=$e$Ich habe Fieber und Kopfschmerzen.$e$, example_ru=$r$У меня температура и головная боль.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$das Fieber$w$;
UPDATE public.language_words lw SET example=$e$Ich habe starken Husten.$e$, example_ru=$r$У меня сильный кашель.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$der Husten$w$;
UPDATE public.language_words lw SET example=$e$Ich habe eine Erkältung.$e$, example_ru=$r$У меня простуда.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$die Erkältung$w$;
UPDATE public.language_words lw SET example=$e$Der Arzt gibt mir ein Rezept.$e$, example_ru=$r$Врач даёт мне рецепт.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$das Rezept$w$;
UPDATE public.language_words lw SET example=$e$Ich habe einen Termin beim Arzt.$e$, example_ru=$r$У меня приём у врача.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$der Termin$w$;
UPDATE public.language_words lw SET example=$e$Fieber ist ein häufiges Symptom.$e$, example_ru=$r$Температура — частый симптом.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$das Symptom$w$;
UPDATE public.language_words lw SET example=$e$Ich möchte gesund sein.$e$, example_ru=$r$Я хочу быть здоровым.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$gesund$w$;
UPDATE public.language_words lw SET example=$e$Die Wunde ist nicht schlimm.$e$, example_ru=$r$Рана не серьёзная.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$die Wunde$w$;
UPDATE public.language_words lw SET example=$e$Nimm morgens eine Tablette.$e$, example_ru=$r$Принимай утром таблетку.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$die Tablette$w$;
UPDATE public.language_words lw SET example=$e$Ich gehe morgen zum Zahnarzt.$e$, example_ru=$r$Я иду завтра к стоматологу.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$der Zahnarzt$w$;
UPDATE public.language_words lw SET example=$e$Ich muss mich ein wenig ausruhen.$e$, example_ru=$r$Мне нужно немного отдохнуть.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$sich ausruhen$w$;

-- ===== DE B1 · character =====
UPDATE public.language_words lw SET example=$e$Er hat einen starken Charakter.$e$, example_ru=$r$У него сильный характер.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$der Charakter$w$;
UPDATE public.language_words lw SET example=$e$Du bist sehr nett.$e$, example_ru=$r$Ты очень добрый.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$nett$w$;
UPDATE public.language_words lw SET example=$e$Sein Bruder ist sehr freundlich.$e$, example_ru=$r$Его брат очень приветливый.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$freundlich$w$;
UPDATE public.language_words lw SET example=$e$Sie ist eine intelligente Person.$e$, example_ru=$r$Она умный человек.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$intelligent$w$;
UPDATE public.language_words lw SET example=$e$Als Kind war er sehr schüchtern.$e$, example_ru=$r$В детстве он был очень застенчивым.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$schüchtern$w$;
UPDATE public.language_words lw SET example=$e$Er ist ein fleißiger Student.$e$, example_ru=$r$Он трудолюбивый студент.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$fleißig$w$;
UPDATE public.language_words lw SET example=$e$Er ist ehrlich und offen.$e$, example_ru=$r$Он честный и открытый.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$ehrlich$w$;
UPDATE public.language_words lw SET example=$e$Sie ist sehr großzügig.$e$, example_ru=$r$Она очень щедрая.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$großzügig$w$;
UPDATE public.language_words lw SET example=$e$Er war sehr mutig.$e$, example_ru=$r$Он был очень смелым.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$mutig$w$;
UPDATE public.language_words lw SET example=$e$Er ist ein ruhiger Mann.$e$, example_ru=$r$Он спокойный человек.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$ruhig$w$;
UPDATE public.language_words lw SET example=$e$Mein Freund ist sehr lustig.$e$, example_ru=$r$Мой друг очень весёлый.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$lustig$w$;
UPDATE public.language_words lw SET example=$e$Heute bist du sehr ernst.$e$, example_ru=$r$Сегодня ты очень серьёзный.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$ernst$w$;
UPDATE public.language_words lw SET example=$e$Sei nicht so faul.$e$, example_ru=$r$Не будь таким ленивым.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='de' AND c.level='B1' AND lw.word=$w$faul$w$;
