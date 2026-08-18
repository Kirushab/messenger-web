# v421 — event media overlay and instant interactive blocks

- Event media viewer now renders through a document-level portal with a high isolated z-index, so event-page back/menu controls cannot overlap it.
- Event block editor save action stays pinned near the bottom of the visible sheet with a small bottom inset.
- Checklist, shopping list, packing list and wishlist interactions now update optimistically instead of waiting for realtime/reload.
- Activity votes and “who brings what” claims now react immediately and then reconcile with Supabase in the background.
- No SQL migration is required.
