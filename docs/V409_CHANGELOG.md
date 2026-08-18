# v409 — Chat delivery, Booking preview and motion

## Group attachment delivery
- Fixed a race where a fetched/realtime server message could replace an optimistic group before `file_attachments` were available, leaving a permanent skeleton.
- Fetch merging now reconciles matching temp messages by sender/content/type/time and preserves local attachments while the server rows catch up.
- Group sends retain an expected attachment count so hydration keeps retrying until the whole batch is present.

## Link previews
- Booking.com previews no longer render the misleading third-party “Generating Preview” image. Booking cards keep the useful title/description/link but omit unreliable imagery.

## Motion
- Reaction rows now expand/collapse with a soft grid-height animation so the message bubble does not jump.
- Reaction chips and emoji use a calmer spring landing.
- Outgoing messages use a softer iMessage-like rise/settle animation.

## Database
- No SQL migration required for v409.
