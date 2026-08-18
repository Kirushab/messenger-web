# v432 — Render build fix

- Исправлена ошибка сборки `Rollup failed to resolve import "jszip"` в `AdminData.tsx`.
- JSZip снова загружается только при использовании функции экспорта медиа и не требуется как npm-зависимость при production build.
- Остальной функционал v431 сохранён без изменений.
- SQL-миграция не требуется.
