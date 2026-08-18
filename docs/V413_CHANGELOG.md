# v413 — Smart video buffering + UI polish

## Stories
- Added a small initial playback buffer for story videos before normal playback settles in.
- The nearest upcoming video story is preloaded in the background through a short-lived off-screen media warm-up pool.
- `waiting` / `stalled` states now show a subtle loading indicator and resume after a small buffer reserve is available, reducing rapid stop/start stutter on weak connections.
- Story video progress remains tied to actual media time.

## Feed
- Feed videos use metadata preload while far away and automatically switch to `preload=auto` before they reach the viewport.
- Added controlled rebuffering and a lightweight loader for poor-network playback stalls.
- Preloading is scoped to nearby content rather than downloading every video in the feed immediately.

## UI
- Optically centered the heart icon inside the circular Story like button.
- Rounded the location-message delete action into a softer pill shape.

## Database
- No SQL migration is required for v413.
