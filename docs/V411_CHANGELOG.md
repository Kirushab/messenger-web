# v411 — Group profile + event chat recovery

## Group profile
- Group info now uses a dedicated internal native-like scroll area instead of scrolling the full overlay like a webpage.
- The top navigation stays stable and browser-style scrollbar/overscroll is hidden.

## Event participants
- Event participant rendering now guarantees the organizer is visible even for legacy rows with incomplete membership data.
- Member loading also refreshes the stored going/maybe counters.

## Event chat
- The event-chat button is always available for non-cancelled events and now has an explicit opening/loading state.
- Before navigating, the app calls `join_event_chat`, which now returns the valid conversation ID and guarantees the current user has chat membership.
- Deleted/missing event chats are recreated automatically and re-linked to the event.
- Past/archived events remain supported; cancelled events stay closed.

## Database
- Added `175_event_chat_recovery.sql`.
