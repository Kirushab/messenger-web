-- ============================================================
-- 163_fr_b1_examples.sql
-- Бэклог по языкам #6: примеры к сложным словам B1 — французский,
-- темы «Технологии», «Здоровье», «Характер» (у них был NULL example).
-- Идемпотентно: UPDATE по language+level+word, dollar-quoting ($e$/$r$/$w$).
-- ============================================================

-- ===== FR B1 · technology =====
UPDATE public.language_words lw SET example=$e$La technologie change très vite.$e$, example_ru=$r$Технологии меняются очень быстро.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$la technologie$w$;
UPDATE public.language_words lw SET example=$e$Mon ordinateur est neuf.$e$, example_ru=$r$Мой компьютер новый.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$l'ordinateur$w$;
UPDATE public.language_words lw SET example=$e$Je n'ai pas internet à la maison.$e$, example_ru=$r$У меня нет интернета дома.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$internet$w$;
UPDATE public.language_words lw SET example=$e$Je t'envoie un e-mail.$e$, example_ru=$r$Я отправлю тебе электронное письмо.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$l'e-mail$w$;
UPDATE public.language_words lw SET example=$e$J'ai oublié mon mot de passe.$e$, example_ru=$r$Я забыл свой пароль.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$le mot de passe$w$;
UPDATE public.language_words lw SET example=$e$L'écran est très grand.$e$, example_ru=$r$Экран очень большой.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$l'écran$w$;
UPDATE public.language_words lw SET example=$e$Enregistre le fichier, s'il te plaît.$e$, example_ru=$r$Сохрани файл, пожалуйста.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$le fichier$w$;
UPDATE public.language_words lw SET example=$e$Cette application est très utile.$e$, example_ru=$r$Это приложение очень полезное.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$l'application$w$;
UPDATE public.language_words lw SET example=$e$Le réseau wifi ne marche pas.$e$, example_ru=$r$Сеть wi-fi не работает.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$le réseau$w$;
UPDATE public.language_words lw SET example=$e$Je veux télécharger le film.$e$, example_ru=$r$Я хочу скачать фильм.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$télécharger$w$;
UPDATE public.language_words lw SET example=$e$Je t'ai envoyé un message.$e$, example_ru=$r$Я отправил тебе сообщение.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$le message$w$;
UPDATE public.language_words lw SET example=$e$La caméra est très bonne.$e$, example_ru=$r$Камера очень хорошая.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$la caméra$w$;
UPDATE public.language_words lw SET example=$e$Entre ton nom d'utilisateur.$e$, example_ru=$r$Введи своё имя пользователя.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$l'utilisateur$w$;

-- ===== FR B1 · health =====
UPDATE public.language_words lw SET example=$e$La santé est le plus important.$e$, example_ru=$r$Здоровье — самое важное.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$la santé$w$;
UPDATE public.language_words lw SET example=$e$C'est une maladie fréquente.$e$, example_ru=$r$Это распространённая болезнь.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$la maladie$w$;
UPDATE public.language_words lw SET example=$e$J'ai de la fièvre et mal à la tête.$e$, example_ru=$r$У меня температура и болит голова.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$la fièvre$w$;
UPDATE public.language_words lw SET example=$e$J'ai une mauvaise toux.$e$, example_ru=$r$У меня сильный кашель.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$la toux$w$;
UPDATE public.language_words lw SET example=$e$J'ai un rhume.$e$, example_ru=$r$У меня простуда.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$le rhume$w$;
UPDATE public.language_words lw SET example=$e$Le médecin me donne une ordonnance.$e$, example_ru=$r$Врач даёт мне рецепт.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$l'ordonnance$w$;
UPDATE public.language_words lw SET example=$e$J'ai un rendez-vous chez le médecin.$e$, example_ru=$r$У меня приём у врача.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$le rendez-vous$w$;
UPDATE public.language_words lw SET example=$e$La fièvre est un symptôme fréquent.$e$, example_ru=$r$Температура — частый симптом.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$le symptôme$w$;
UPDATE public.language_words lw SET example=$e$Je veux être en bonne santé.$e$, example_ru=$r$Я хочу быть здоровым.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$en bonne santé$w$;
UPDATE public.language_words lw SET example=$e$La blessure n'est pas grave.$e$, example_ru=$r$Рана не серьёзная.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$la blessure$w$;
UPDATE public.language_words lw SET example=$e$Prends un comprimé le matin.$e$, example_ru=$r$Принимай таблетку утром.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$le comprimé$w$;
UPDATE public.language_words lw SET example=$e$Je vais chez le dentiste demain.$e$, example_ru=$r$Я иду к стоматологу завтра.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$le dentiste$w$;
UPDATE public.language_words lw SET example=$e$J'ai besoin de me reposer un peu.$e$, example_ru=$r$Мне нужно немного отдохнуть.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$se reposer$w$;

-- ===== FR B1 · character =====
UPDATE public.language_words lw SET example=$e$Il a un caractère fort.$e$, example_ru=$r$У него сильный характер.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$le caractère$w$;
UPDATE public.language_words lw SET example=$e$Tu es très gentil.$e$, example_ru=$r$Ты очень добрый.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$gentil$w$;
UPDATE public.language_words lw SET example=$e$Son frère est très sympathique.$e$, example_ru=$r$Его брат очень приятный.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$sympathique$w$;
UPDATE public.language_words lw SET example=$e$C'est une personne intelligente.$e$, example_ru=$r$Это умный человек.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$intelligent$w$;
UPDATE public.language_words lw SET example=$e$Enfant, il était très timide.$e$, example_ru=$r$В детстве он был очень застенчивым.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$timide$w$;
UPDATE public.language_words lw SET example=$e$C'est un étudiant travailleur.$e$, example_ru=$r$Он трудолюбивый студент.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$travailleur$w$;
UPDATE public.language_words lw SET example=$e$Il est honnête et sincère.$e$, example_ru=$r$Он честный и искренний.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$honnête$w$;
UPDATE public.language_words lw SET example=$e$Il est très généreux avec tout le monde.$e$, example_ru=$r$Он очень щедрый со всеми.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$généreux$w$;
UPDATE public.language_words lw SET example=$e$Il a été très courageux.$e$, example_ru=$r$Он был очень смелым.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$courageux$w$;
UPDATE public.language_words lw SET example=$e$C'est un homme calme.$e$, example_ru=$r$Он спокойный человек.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$calme$w$;
UPDATE public.language_words lw SET example=$e$Mon ami est très amusant.$e$, example_ru=$r$Мой друг очень весёлый.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$amusant$w$;
UPDATE public.language_words lw SET example=$e$Aujourd'hui tu es très sérieux.$e$, example_ru=$r$Сегодня ты очень серьёзный.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$sérieux$w$;
UPDATE public.language_words lw SET example=$e$Ne sois pas paresseux.$e$, example_ru=$r$Не будь ленивым.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='fr' AND c.level='B1' AND lw.word=$w$paresseux$w$;
