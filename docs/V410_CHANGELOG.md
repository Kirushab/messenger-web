# v410 — Booking.com rich hotel previews

## Link preview / parser
- Restored image rendering for `booking.com` link cards in chat.
- Added Booking-specific extraction inside the `link-preview` Edge Function so hotel links prefer real `bstatic` property photos instead of weak placeholders or generic screenshot fallbacks.
- Added a refresh path on the client for Booking previews that still have a weak cached image (for example a screenshot fallback from an older cached preview).

## Deployment
- No SQL migration is required.
- This release does require redeploying the Supabase Edge Function `link-preview`.
