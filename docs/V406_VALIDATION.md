# v406 validation

- TypeScript/TSX syntax for the modified `MapPage.tsx` and `FriendsBottomSheet.tsx` was parsed/transpiled with TypeScript 5.8.3: no syntax diagnostics.
- Reviewed the v406 diff against v405 for map-sheet, navigator follow/free-camera behavior, and navigation-marker CSS.
- Full dependency typecheck/Vite build could not be completed in this sandbox because `npm ci` could not finish installing registry packages in the available execution/network window.
- No database schema changes were made; no migration was added.
