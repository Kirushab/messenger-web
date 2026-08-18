# v417 — Story replies and event link polish

## Posts / events
- Nudged the Create Post event-link icon for better optical alignment.
- Reworked the feed event association into a compact, minimal inline chip.

## Stories
- Story playback now pauses while the reply input is focused or a comment is being sent.
- Added a dedicated send button; Enter remains available as a keyboard shortcut.
- Story comments are sent as normal chat messages with a persistent story snapshot attached.

## Chat
- Story comments render with a compact story preview containing the original author, media and caption.
- The preview is snapshot-based rather than querying the live story row, so deletion/expiration of the story does not break the chat message.
- If the original media URL later becomes unavailable, the card falls back to a clean “story unavailable” state instead of a broken image.

## Database
- Migration 177 adds `messages.story_reply_snapshot JSONB`.
