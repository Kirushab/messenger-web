# v395 validation

Проверено 27 июля 2026:

- TypeScript/TSX syntax parse: `LanguageTrainer.tsx`, `EduSettings.tsx`, `Feed.tsx`, `version.ts` — успешно.
- `npm run check:tokens` — успешно.
- `npm run scan:secrets` — успешно.
- Проверено отсутствие строки/блока «Ещё пример» и компонента пустой иконки ленты.
- Полный `npm run verify:release` не запускался: в рабочей среде нет установленных `node_modules`.
- SQL-миграции и Edge Functions не изменялись.
