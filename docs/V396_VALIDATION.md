# v396 validation

Проверено:

- синтаксический разбор `src/pages/MapPage.tsx` через TypeScript `transpileModule`;
- отсутствие старых подписей «Навигатор», «Сверху» и «Поехать» в панели маршрута;
- `npm run check:tokens`;
- `npm run scan:secrets`;
- целостность итогового ZIP-архива.

Полный `npm run verify:release` не запускался: в рабочей копии отсутствует каталог `node_modules`.
