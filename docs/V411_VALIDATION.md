# v411 validation

- Updated `Chat.tsx` + `App.css` for internal native group-profile scrolling.
- Updated `EventView.tsx` for participant fallback and self-healing chat opening.
- Updated `eventsStore.ts` to refresh participant aggregate counts.
- Added migration `175_event_chat_recovery.sql` to repair creator memberships and recover event chats.
- Modified TypeScript/TSX files should be transpile-checked before packaging.
