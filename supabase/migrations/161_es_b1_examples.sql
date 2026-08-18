-- ============================================================
-- 161_es_b1_examples.sql
-- Бэклог по языкам #6: примеры к сложным словам B1 — испанский,
-- темы «Технологии», «Здоровье», «Характер» (у них был NULL example).
-- Идемпотентно: UPDATE по language+level+word, dollar-quoting ($e$/$r$/$w$).
-- ============================================================

-- ===== ES B1 · technology =====
UPDATE public.language_words lw SET example=$e$La tecnología cambia muy rápido.$e$, example_ru=$r$Технологии меняются очень быстро.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la tecnología$w$;
UPDATE public.language_words lw SET example=$e$Mi ordenador es nuevo.$e$, example_ru=$r$Мой компьютер новый.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$el ordenador$w$;
UPDATE public.language_words lw SET example=$e$No tengo internet en casa.$e$, example_ru=$r$У меня нет интернета дома.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$internet$w$;
UPDATE public.language_words lw SET example=$e$Te envío un correo electrónico.$e$, example_ru=$r$Я отправлю тебе электронное письмо.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$el correo electrónico$w$;
UPDATE public.language_words lw SET example=$e$No recuerdo mi contraseña.$e$, example_ru=$r$Я не помню свой пароль.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la contraseña$w$;
UPDATE public.language_words lw SET example=$e$La pantalla es muy grande.$e$, example_ru=$r$Экран очень большой.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la pantalla$w$;
UPDATE public.language_words lw SET example=$e$Guarda el archivo, por favor.$e$, example_ru=$r$Сохрани файл, пожалуйста.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$el archivo$w$;
UPDATE public.language_words lw SET example=$e$Esta aplicación es muy útil.$e$, example_ru=$r$Это приложение очень полезное.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la aplicación$w$;
UPDATE public.language_words lw SET example=$e$La red wifi no funciona.$e$, example_ru=$r$Сеть wi-fi не работает.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la red$w$;
UPDATE public.language_words lw SET example=$e$Voy a descargar la película.$e$, example_ru=$r$Я скачаю фильм.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$descargar$w$;
UPDATE public.language_words lw SET example=$e$Te he enviado un mensaje.$e$, example_ru=$r$Я отправил тебе сообщение.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$el mensaje$w$;
UPDATE public.language_words lw SET example=$e$La cámara del móvil es buena.$e$, example_ru=$r$Камера телефона хорошая.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la cámara$w$;
UPDATE public.language_words lw SET example=$e$Escribe tu nombre de usuario.$e$, example_ru=$r$Введи своё имя пользователя.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$el usuario$w$;

-- ===== ES B1 · health =====
UPDATE public.language_words lw SET example=$e$La salud es lo más importante.$e$, example_ru=$r$Здоровье — самое важное.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la salud$w$;
UPDATE public.language_words lw SET example=$e$Es una enfermedad común.$e$, example_ru=$r$Это распространённая болезнь.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la enfermedad$w$;
UPDATE public.language_words lw SET example=$e$Tengo fiebre y me duele la cabeza.$e$, example_ru=$r$У меня температура и болит голова.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la fiebre$w$;
UPDATE public.language_words lw SET example=$e$Tengo mucha tos.$e$, example_ru=$r$У меня сильный кашель.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la tos$w$;
UPDATE public.language_words lw SET example=$e$Tengo un resfriado.$e$, example_ru=$r$У меня простуда.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$el resfriado$w$;
UPDATE public.language_words lw SET example=$e$El médico me da una receta.$e$, example_ru=$r$Врач даёт мне рецепт.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la receta$w$;
UPDATE public.language_words lw SET example=$e$Tengo cita con el médico.$e$, example_ru=$r$У меня приём у врача.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la cita$w$;
UPDATE public.language_words lw SET example=$e$La fiebre es un síntoma común.$e$, example_ru=$r$Температура — частый симптом.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$el síntoma$w$;
UPDATE public.language_words lw SET example=$e$Quiero estar sano.$e$, example_ru=$r$Я хочу быть здоровым.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$sano$w$;
UPDATE public.language_words lw SET example=$e$La herida no es grave.$e$, example_ru=$r$Рана не серьёзная.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la herida$w$;
UPDATE public.language_words lw SET example=$e$Toma una pastilla por la mañana.$e$, example_ru=$r$Принимай таблетку утром.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$la pastilla$w$;
UPDATE public.language_words lw SET example=$e$Voy al dentista mañana.$e$, example_ru=$r$Я иду к стоматологу завтра.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$el dentista$w$;
UPDATE public.language_words lw SET example=$e$Necesito descansar un poco.$e$, example_ru=$r$Мне нужно немного отдохнуть.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$descansar$w$;

-- ===== ES B1 · character =====
UPDATE public.language_words lw SET example=$e$Tiene un carácter fuerte.$e$, example_ru=$r$У него сильный характер.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$el carácter$w$;
UPDATE public.language_words lw SET example=$e$Eres muy amable.$e$, example_ru=$r$Ты очень добрый.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$amable$w$;
UPDATE public.language_words lw SET example=$e$Su hermano es muy simpático.$e$, example_ru=$r$Его брат очень приятный.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$simpático$w$;
UPDATE public.language_words lw SET example=$e$Es una persona inteligente.$e$, example_ru=$r$Это умный человек.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$inteligente$w$;
UPDATE public.language_words lw SET example=$e$De niño era muy tímido.$e$, example_ru=$r$В детстве он был очень застенчивым.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$tímido$w$;
UPDATE public.language_words lw SET example=$e$Es un estudiante trabajador.$e$, example_ru=$r$Он трудолюбивый студент.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$trabajador$w$;
UPDATE public.language_words lw SET example=$e$Es honesto y sincero.$e$, example_ru=$r$Он честный и искренний.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$honesto$w$;
UPDATE public.language_words lw SET example=$e$Es muy generoso con todos.$e$, example_ru=$r$Он очень щедрый со всеми.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$generoso$w$;
UPDATE public.language_words lw SET example=$e$Fue muy valiente.$e$, example_ru=$r$Он был очень смелым.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$valiente$w$;
UPDATE public.language_words lw SET example=$e$Es un hombre tranquilo.$e$, example_ru=$r$Он спокойный человек.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$tranquilo$w$;
UPDATE public.language_words lw SET example=$e$Mi amigo es muy divertido.$e$, example_ru=$r$Мой друг очень весёлый.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$divertido$w$;
UPDATE public.language_words lw SET example=$e$Hoy estás muy serio.$e$, example_ru=$r$Сегодня ты очень серьёзный.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$serio$w$;
UPDATE public.language_words lw SET example=$e$No seas perezoso.$e$, example_ru=$r$Не будь ленивым.$r$ FROM public.language_courses c WHERE lw.course_id=c.id AND c.language='es' AND c.level='B1' AND lw.word=$w$perezoso$w$;
