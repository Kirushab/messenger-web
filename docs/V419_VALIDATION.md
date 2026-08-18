# v419 validation

- TypeScript transpile check passed for `Chat.tsx`, `StoryEditor.tsx`, `MapPage.tsx`, `FriendsBottomSheet.tsx`, and `Layout.tsx`.
- Chat route no longer uses the route fade entrance; existing message mount animations are suppressed while optimistic send/reaction animations remain available.
- Story editor photo/video controls use a shared integrated media picker in both empty and populated states.
- Missing-location map prompt can be collapsed and restored from a compact right-side reminder.
- Event cards in the map bottom sheet reserve a location row and use a fixed card height for vertical alignment.
- No SQL migration required.
- Full Vite build was not run because the provided archive does not contain `node_modules/.bin/vite`.
