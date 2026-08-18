# v405 — Video previews and feed aspect ratio

## Create post
- Video files now get a real frame thumbnail instead of a black rectangle.
- Video thumbnails have a small play badge.
- Removed the redundant `Фото` / `Видео` labels from the top-right of the media card.
- Replaced the squeezed publish control with a fixed 40×40 circular upload icon.

## Create story
- Video files now generate a thumbnail frame and use it as the video poster/strip thumbnail.
- Replaced text photo/video selectors with compact icon controls.
- Replaced the publish text/control with the same fixed circular upload icon.

## Feed
- Video posts no longer use a forced square stage.
- The stage follows the video's real width/height ratio after metadata loads; new posts can persist dimensions.
- New video posts generate and upload a JPEG poster so the feed shows a real preview before playback.
- Existing videos without a stored poster get a best-effort client-side frame fallback and seek off t=0 to avoid iOS black frames.

## Profile
- Video cells and the full-screen preview use stored poster images when available.

## Database
- Added migration `174_post_media_video_preview.sql` with nullable `preview_url`, `width`, and `height` fields on `post_media`.
- Post creation remains backward-compatible if the migration has not been applied yet, but persistent server-side posters/dimensions require it.
