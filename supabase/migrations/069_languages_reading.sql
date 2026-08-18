-- ============================================================
-- 069_languages_reading.sql
-- Чтение с пониманием: тексты + вопросы на понимание.
-- Главный тип упражнения IELTS Reading / CILS Comprensione.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.language_passages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language     text NOT NULL CHECK (language IN ('en', 'it')),
  level        text NOT NULL DEFAULT 'IELTS',  -- IELTS или CILS
  order_index  int  NOT NULL,
  title_ru     text NOT NULL,
  topic_emoji  text NOT NULL DEFAULT '📖',
  passage      text NOT NULL,                  -- сам текст на иностранном
  passage_ru   text,                           -- опциональный перевод (показывается в финише)
  questions    jsonb NOT NULL,                 -- [{q_ru: "...", options: ["..."], correct: 0}]
  UNIQUE (language, level, order_index)
);

CREATE TABLE IF NOT EXISTS public.language_passage_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  passage_id    uuid NOT NULL REFERENCES public.language_passages(id) ON DELETE CASCADE,
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  total         int  NOT NULL DEFAULT 0,
  correct       int  NOT NULL DEFAULT 0,
  duration_sec  int  NOT NULL DEFAULT 0,
  coins_earned  int  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lang_passage_sessions_user
  ON public.language_passage_sessions(user_id, passage_id, ended_at DESC);

-- RLS
ALTER TABLE public.language_passages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_passage_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads passages" ON public.language_passages;
CREATE POLICY "Anyone reads passages" ON public.language_passages FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "User reads own passage sessions" ON public.language_passage_sessions;
CREATE POLICY "User reads own passage sessions" ON public.language_passage_sessions FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "User writes own passage sessions" ON public.language_passage_sessions;
CREATE POLICY "User writes own passage sessions" ON public.language_passage_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RPC: завершение сессии чтения. Атомарно: запись + монетки + стрик.
DROP FUNCTION IF EXISTS public.finalize_reading_session(uuid, int, int, int);

CREATE OR REPLACE FUNCTION public.finalize_reading_session(
  passage_id_param uuid,
  total_param      int,
  correct_param    int,
  duration_param   int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_accuracy     int;
  v_coins        int;
  v_session_id   uuid;
  v_today        date := CURRENT_DATE;
  v_last_day     date;
  v_old_streak   int;
  v_new_streak   int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF total_param <= 0 THEN RAISE EXCEPTION 'empty session'; END IF;

  v_accuracy := (correct_param * 100 / total_param);
  -- Чтение труднее — +2 за каждый ответ + бонус 10 за 100% и ≥3 вопросов
  v_coins := correct_param * 2 + (CASE WHEN v_accuracy = 100 AND total_param >= 3 THEN 10 ELSE 0 END);

  INSERT INTO public.language_passage_sessions
    (user_id, passage_id, ended_at, total, correct, duration_sec, coins_earned)
  VALUES (v_uid, passage_id_param, now(), total_param, correct_param, duration_param, v_coins)
  RETURNING id INTO v_session_id;

  -- Стрик (общий с обычными уроками)
  SELECT lang_streak, lang_streak_last_day INTO v_old_streak, v_last_day
  FROM public.users WHERE id = v_uid;

  IF v_last_day = v_today THEN
    v_new_streak := v_old_streak;
  ELSIF v_last_day = v_today - INTERVAL '1 day' THEN
    v_new_streak := COALESCE(v_old_streak, 0) + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  UPDATE public.users
  SET coins                = COALESCE(coins, 0) + v_coins,
      lang_streak          = v_new_streak,
      lang_streak_last_day = v_today
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'accuracy', v_accuracy,
    'coins_earned', v_coins,
    'completed', v_accuracy >= 67,    -- для чтения 2/3 достаточно (мягче чем 80%)
    'streak', v_new_streak,
    'streak_increased', v_new_streak > COALESCE(v_old_streak, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_reading_session(uuid, int, int, int) TO authenticated;

-- ============ КОНТЕНТ ============

-- Пересоздаём чтобы можно было запускать повторно
DELETE FROM public.language_passages;

-- ===== EN IELTS =====

INSERT INTO public.language_passages (language, level, order_index, title_ru, topic_emoji, passage, passage_ru, questions) VALUES
('en', 'IELTS', 1, 'Изменение климата', '🌍',
'Climate change is one of the most urgent challenges of our time. Scientists agree that human activity, especially burning fossil fuels, has caused a significant rise in global temperatures over the past century. The effects are visible everywhere: melting glaciers, more frequent storms, and threats to wildlife. Many governments now invest in renewable energy like solar and wind power. However, individual actions also matter. Recycling, using public transport, and reducing meat consumption can all help reduce a person''s carbon footprint.',
'Изменение климата — одна из самых срочных проблем нашего времени. Учёные согласны, что деятельность человека, особенно сжигание ископаемого топлива, вызвала значительный рост температур за последний век. Эффекты видны везде: тают ледники, чаще случаются штормы, угроза дикой природе. Многие правительства инвестируют в возобновляемую энергию вроде солнечной и ветровой. Однако индивидуальные действия тоже важны. Переработка, общественный транспорт и сокращение мяса помогают уменьшить углеродный след.',
'[
  {"q_ru": "What is the main cause of climate change according to the passage?", "options": ["Natural cycles", "Human activity, especially burning fossil fuels", "Volcanic eruptions", "Solar radiation"], "correct": 1},
  {"q_ru": "Which effect of climate change is NOT mentioned?", "options": ["Melting glaciers", "More frequent storms", "Earthquakes", "Threats to wildlife"], "correct": 2},
  {"q_ru": "According to the text, what can individuals do to help?", "options": ["Build solar panels", "Recycle and use public transport", "Move to colder countries", "Stop using electricity"], "correct": 1}
]'::jsonb),

('en', 'IELTS', 2, 'Технологии в образовании', '💻',
'The role of technology in classrooms has grown dramatically. Tablets, online lessons, and educational software are now common from primary school to university. Supporters argue that technology makes learning more interactive and personalized. Students can study at their own pace and access vast amounts of information instantly. On the other hand, critics warn that too much screen time can reduce social skills and damage attention spans. There is also concern about inequality: not every family can afford devices. Most teachers agree that the best approach combines digital tools with traditional teaching.',
'Роль технологий в школах сильно выросла. Планшеты, онлайн-уроки и обучающее ПО теперь обычны от начальной школы до университета. Сторонники утверждают, что технологии делают обучение более интерактивным и персонализированным. Ученики могут учиться в своём темпе и получать огромные объёмы информации мгновенно. С другой стороны, критики предупреждают, что слишком много экрана может снижать социальные навыки и портить внимание. Также есть вопрос неравенства: не каждая семья может позволить устройства. Большинство учителей согласны, что лучший подход — комбинация цифровых инструментов и традиционного обучения.',
'[
  {"q_ru": "What is the main argument FOR using technology in schools?", "options": ["It is cheaper than books", "It makes learning interactive and personalized", "It replaces teachers", "It improves discipline"], "correct": 1},
  {"q_ru": "What concern is raised about inequality?", "options": ["Some students learn faster", "Not every family can afford devices", "Schools have different budgets", "Teachers earn different salaries"], "correct": 1},
  {"q_ru": "What is the position of most teachers?", "options": ["Reject technology completely", "Use only digital tools", "Combine digital with traditional teaching", "Wait for better technology"], "correct": 2}
]'::jsonb),

('en', 'IELTS', 3, 'Здоровый образ жизни', '🏃',
'A healthy lifestyle is built on three pillars: balanced diet, regular exercise, and enough sleep. Doctors recommend at least 30 minutes of physical activity five times per week — this can be as simple as walking. Eating a variety of vegetables, whole grains, and lean protein supports the immune system. Sleep is often overlooked but crucial: most adults need seven to nine hours per night for proper brain function. Stress management also plays a key role. Practices like meditation, time in nature, and social connections can lower cortisol levels and improve overall wellbeing.',
'Здоровый образ жизни строится на трёх столпах: сбалансированное питание, регулярная физическая активность и достаточный сон. Врачи рекомендуют минимум 30 минут активности 5 раз в неделю — это может быть просто ходьба. Разнообразие овощей, цельных злаков и постного белка поддерживает иммунитет. Сон часто недооценивают, но он критичен: большинству взрослых нужно 7-9 часов в сутки для нормальной работы мозга. Управление стрессом тоже важно. Медитация, время на природе и социальные связи понижают кортизол и улучшают самочувствие.',
'[
  {"q_ru": "How much physical activity do doctors recommend per week?", "options": ["1 hour", "30 minutes once a week", "At least 30 minutes, 5 times a week", "Every day, 2 hours"], "correct": 2},
  {"q_ru": "How many hours of sleep do most adults need?", "options": ["4-5 hours", "5-6 hours", "7-9 hours", "10+ hours"], "correct": 2},
  {"q_ru": "Which is NOT mentioned as a stress management practice?", "options": ["Meditation", "Time in nature", "Watching TV", "Social connections"], "correct": 2}
]'::jsonb);

-- ===== IT CILS =====

INSERT INTO public.language_passages (language, level, order_index, title_ru, topic_emoji, passage, passage_ru, questions) VALUES
('it', 'CILS', 1, 'Кухня и культура Италии', '🍝',
'La cucina italiana è famosa in tutto il mondo, ma è importante capire che non esiste un solo modo di cucinare "all''italiana". Ogni regione ha le sue tradizioni, i suoi ingredienti e le sue ricette. Al nord si usano spesso burro e riso, come nel risotto milanese. Al centro e al sud invece dominano l''olio d''oliva, la pasta e i pomodori. Il pasto italiano tradizionale ha più portate: antipasto, primo, secondo con contorno, e dolce. Mangiare insieme è considerato un momento sociale importante, non solo un bisogno fisico.',
'Итальянская кухня знаменита во всём мире, но важно понимать, что нет одного способа готовить «по-итальянски». У каждого региона свои традиции, свои ингредиенты и свои рецепты. На севере часто используют масло и рис, как в миланском ризотто. На центре и юге доминируют оливковое масло, паста и помидоры. Традиционный итальянский обед состоит из нескольких блюд: антипасто, первое, второе с гарниром и десерт. Есть вместе считается важным социальным моментом, а не просто физической потребностью.',
'[
  {"q_ru": "Cosa si usa spesso al nord Italia?", "options": ["Olio d''oliva e pomodori", "Burro e riso", "Solo pesce", "Solo verdure"], "correct": 1},
  {"q_ru": "Quante portate ha un pasto italiano tradizionale?", "options": ["Una", "Due", "Tre", "Più portate (antipasto, primo, secondo, dolce)"], "correct": 3},
  {"q_ru": "Cosa significa mangiare insieme per gli italiani?", "options": ["Solo un bisogno fisico", "Un momento sociale importante", "Una perdita di tempo", "Un''abitudine recente"], "correct": 1}
]'::jsonb),

('it', 'CILS', 2, 'Школа в Италии', '🎒',
'Il sistema scolastico italiano è diviso in vari livelli. I bambini iniziano la scuola dell''infanzia a tre anni, anche se non è obbligatoria. La scuola primaria dura cinque anni, poi seguono tre anni di scuola media. Dopo i 14 anni gli studenti scelgono una scuola superiore: il liceo (classico, scientifico, linguistico) prepara all''università, mentre gli istituti tecnici e professionali offrono una formazione più pratica. L''università italiana è organizzata in laurea triennale e magistrale. L''istruzione pubblica è gratuita, ma molti studenti pagano tasse universitarie basate sul reddito familiare.',
'Школьная система Италии делится на несколько уровней. Дети начинают детский сад в три года, хотя он не обязателен. Начальная школа длится пять лет, потом три года средней. После 14 лет ученики выбирают старшую школу: лицей (классический, научный, лингвистический) готовит к университету, а технические и профессиональные институты дают более практическое образование. Итальянский университет организован в три года бакалавриата и магистратуру. Государственное образование бесплатное, но многие студенты платят сборы на основе семейного дохода.',
'[
  {"q_ru": "A che età iniziano la scuola dell''infanzia i bambini italiani?", "options": ["A 2 anni", "A 3 anni", "A 5 anni", "A 6 anni"], "correct": 1},
  {"q_ru": "Cosa prepara meglio all''università?", "options": ["L''istituto tecnico", "L''istituto professionale", "Il liceo", "La scuola media"], "correct": 2},
  {"q_ru": "L''istruzione pubblica italiana è...", "options": ["Sempre molto costosa", "Gratuita, ma con tasse basate sul reddito", "Solo per cittadini italiani", "Solo privata"], "correct": 1}
]'::jsonb),

('it', 'CILS', 3, 'Окружающая среда и переработка', '♻️',
'Negli ultimi anni l''Italia ha fatto progressi significativi nella protezione dell''ambiente. La raccolta differenziata è ora obbligatoria in quasi tutti i comuni: i cittadini devono separare carta, plastica, vetro e organico. Anche se i risultati variano da regione a regione, alcune città del nord hanno tassi di riciclo superiori al 70%. Tuttavia, restano molte sfide. L''inquinamento dell''aria nelle grandi città è ancora un problema serio, soprattutto a Milano e Roma. Il governo investe in trasporti pubblici elettrici e in energia rinnovabile, ma molti esperti dicono che servono azioni più rapide per raggiungere gli obiettivi europei.',
'В последние годы Италия добилась значительного прогресса в защите окружающей среды. Раздельный сбор мусора теперь обязателен почти во всех муниципалитетах: граждане должны разделять бумагу, пластик, стекло и органику. Хотя результаты разнятся между регионами, некоторые города на севере имеют показатели переработки выше 70%. Однако остаётся много вызовов. Загрязнение воздуха в больших городах ещё серьёзная проблема, особенно в Милане и Риме. Правительство инвестирует в электротранспорт и возобновляемую энергию, но многие эксперты говорят, что нужны более быстрые действия для целей ЕС.',
'[
  {"q_ru": "Cos''è obbligatorio in quasi tutti i comuni italiani?", "options": ["Comprare auto elettriche", "La raccolta differenziata", "Avere pannelli solari", "Andare in bici"], "correct": 1},
  {"q_ru": "In quali città l''inquinamento dell''aria è ancora un problema?", "options": ["Solo nei paesi piccoli", "A Milano e Roma", "In nessuna città", "Solo al sud"], "correct": 1},
  {"q_ru": "Cosa dicono molti esperti sulle azioni del governo?", "options": ["Sono già perfette", "Servono azioni più rapide", "Non sono necessarie", "Sono troppo costose"], "correct": 1}
]'::jsonb);
