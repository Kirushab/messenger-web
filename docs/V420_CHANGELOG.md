# v420 — event map / edit polish

## Map event preview
- The compact event sheet now uses the exact filled plane/star silhouettes used by event markers on the map.
- The small ETA car icon was redrawn as a strict side-profile vehicle.
- Sharing from the event map sheet now sends the event widget/card itself instead of a plain location message.

## Bottom safe-zone cleanup
- Removed the extra bottom safe-area strip from the chat picker opened from the event map sheet.
- Added a `flushBottom` option to `FormSheet` and enabled it for the event block editor so it no longer leaves the extra white strip at the bottom.

## Event editor
- The main event edit screen now mirrors the visual language of event creation: same back icon, type selector, form class, cover picker styling and save CTA treatment.

## Database
- No SQL migration required.
