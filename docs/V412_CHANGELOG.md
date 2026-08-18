# v412 — Event editor mode + photo/video media

## Event view / editor
- Added a dedicated editor mode opened from the top pencil button.
- Normal event viewing is intentionally cleaner: add/edit/delete controls are hidden until editor mode is active.
- Creator-only structural actions such as block management and playlist linking are shown only in editor mode.
- Participant content blocks still remain readable and interactive in view mode where appropriate, while content creation/editing moves to editor mode.

## Media block
- Renamed the event photo gallery to **Media**.
- Added photo + video selection (`image/*,video/*`).
- Videos support up to 50 MB and get a generated JPEG poster whenever the device can decode a frame.
- Video thumbnails show a play overlay; fullscreen preview uses native video controls.
- Event list/calendar image carousels use `preview_url` for video rows.

## Database
- Added migration `176_event_media_video.sql`.
- Adds `preview_url` and `preview_path` to `event_photos`.
- Expands `event-photos` storage bucket MIME types to common image/video formats and raises the file limit to 50 MB.
