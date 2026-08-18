# v408 — Share / Map / Media polish

## UI fixes
- Centered the round send icon in the map/chat sharing sheet for a cleaner visual balance.
- Archive back button now matches the size of user avatar circles.
- Learning settings (`/learn/settings`) now hide the bottom navigation bar.

## Map
- Prevented the friends bottom sheet from flashing open at full height before settling into the peek state.
- Added a forced visible marker for a friend selected from search, even when the people layer is disabled.
- The selected friend marker stays available when building a route to that person.

## Chat attachments
- Added a dedicated **Видео** tile to the attachment panel for sending videos directly.
- Media send preview now generates thumbnail images for videos instead of showing black boxes.
- Added reinforced autofocus for the caption field in the media send preview to reduce iOS keyboard collapse issues.

## Database
- No SQL migration required for v408.
