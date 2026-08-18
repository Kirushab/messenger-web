-- 109_italian_reading_b2.sql
-- Итальянские тексты для чтения уровня B2 (длиннее, абстрактнее) с переводом и вопросами.

INSERT INTO public.language_passages (id, language, level, order_index, title_ru, topic_emoji, passage, passage_ru, questions) VALUES
(gen_random_uuid(), 'it', 'B2', 1, 'Удалённая работа', '💻',
$it$Negli ultimi anni, il lavoro da remoto è diventato sempre più comune. Molte aziende permettono ai dipendenti di lavorare da casa, almeno per alcuni giorni alla settimana. Questo cambiamento ha portato sia vantaggi che svantaggi.

Tra i vantaggi, il più evidente è la flessibilità. Chi lavora da casa non perde tempo negli spostamenti e può organizzare la giornata in modo più libero. Inoltre, molte persone dicono di essere più concentrate quando non sono in un ufficio rumoroso.

Tuttavia, ci sono anche aspetti negativi. Alcuni lavoratori si sentono isolati, perché passano poco tempo con i colleghi. Altri trovano difficile separare il lavoro dalla vita privata: quando l'ufficio è in casa, è facile continuare a lavorare anche la sera.

Secondo molti esperti, la soluzione migliore è un modello ibrido, che unisce giorni in ufficio e giorni a casa. In questo modo si mantengono i rapporti umani senza rinunciare alla flessibilità. È probabile che in futuro questo sistema diventi la norma per molte professioni.$it$,
$ru$В последние годы удалённая работа стала всё более распространённой. Многие компании разрешают сотрудникам работать из дома, хотя бы несколько дней в неделю. Это изменение принесло как преимущества, так и недостатки.

Среди преимуществ самое очевидное — гибкость. Тот, кто работает из дома, не теряет время на дорогу и может организовать день более свободно. Кроме того, многие говорят, что более сосредоточены, когда не находятся в шумном офисе.

Однако есть и отрицательные стороны. Некоторые работники чувствуют себя изолированными, потому что мало времени проводят с коллегами. Другим трудно отделить работу от личной жизни: когда офис дома, легко продолжать работать и вечером.

По мнению многих экспертов, лучшее решение — гибридная модель, сочетающая дни в офисе и дни дома. Так сохраняются человеческие отношения без отказа от гибкости. Вероятно, в будущем эта система станет нормой для многих профессий.$ru$,
$j$[
  {"q_ru":"Что стало более распространённым в последние годы?","options":["Работа в офисе","Удалённая работа","Ночные смены","Командировки"],"correct":1},
  {"q_ru":"Какое преимущество названо самым очевидным?","options":["Высокая зарплата","Гибкость","Новая техника","Бесплатные обеды"],"correct":1},
  {"q_ru":"Какой недостаток упомянут?","options":["Чувство изоляции","Слишком много отпусков","Низкая зарплата","Шумный офис"],"correct":0},
  {"q_ru":"Какое решение эксперты считают лучшим?","options":["Только офис","Только дом","Гибридная модель","Отказ от работы"],"correct":2}
]$j$::jsonb),

(gen_random_uuid(), 'it', 'B2', 2, 'Сладкое ничегонеделание', '☕',
$it$In Italia esiste un'espressione famosa: «il dolce far niente», cioè la dolcezza di non fare nulla. Per molti stranieri questa idea può sembrare strana, soprattutto in una società che valorizza la produttività e il lavoro continuo.

In realtà, «il dolce far niente» non significa essere pigri. Significa concedersi del tempo per rilassarsi, godere di un buon caffè, fare una passeggiata o semplicemente osservare il mondo intorno. È un modo per ritrovare l'equilibrio e ridurre lo stress.

Diversi studi confermano che le pause sono importanti per la salute mentale. Una mente sempre occupata si stanca e diventa meno creativa. Al contrario, dopo un momento di riposo, spesso troviamo soluzioni migliori ai nostri problemi.

Forse, allora, gli italiani hanno capito qualcosa di importante. In un mondo che corre sempre più veloce, sapersi fermare e apprezzare le piccole cose è diventato un vero lusso — e una necessità.$it$,
$ru$В Италии существует знаменитое выражение: «il dolce far niente», то есть сладость ничегонеделания. Многим иностранцам эта идея может показаться странной, особенно в обществе, которое ценит продуктивность и непрерывную работу.

На самом деле «il dolce far niente» не означает быть ленивым. Это значит позволить себе время, чтобы расслабиться, насладиться хорошим кофе, прогуляться или просто наблюдать за миром вокруг. Это способ вернуть равновесие и снизить стресс.

Различные исследования подтверждают, что паузы важны для психического здоровья. Постоянно занятый ум устаёт и становится менее креативным. Напротив, после момента отдыха мы часто находим лучшие решения наших проблем.

Возможно, итальянцы поняли что-то важное. В мире, который мчится всё быстрее, умение остановиться и ценить мелочи стало настоящей роскошью — и необходимостью.$ru$,
$j$[
  {"q_ru":"Что означает «il dolce far niente»?","options":["Тяжёлый труд","Сладость ничегонеделания","Вкусная еда","Быстрая работа"],"correct":1},
  {"q_ru":"Это выражение означает быть ленивым?","options":["Да, именно так","Нет, это про отдых и равновесие","Да, всегда","Это про спорт"],"correct":1},
  {"q_ru":"Что подтверждают исследования?","options":["Паузы вредны","Паузы важны для психического здоровья","Кофе вреден","Нужно работать больше"],"correct":1},
  {"q_ru":"Чем стало умение остановиться в современном мире?","options":["Ненужным","Роскошью и необходимостью","Ошибкой","Модой"],"correct":1}
]$j$::jsonb);
