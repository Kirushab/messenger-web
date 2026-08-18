# v406 — Map sheet motion and navigator free camera

## Map bottom sheet
- Layer filter chips no longer disappear abruptly when the Friends/Sigmas sheet opens.
- The sheet reports its live drag progress to the map, so the filter strip fades, lifts, and slightly scales down before the sheet physically covers it.
- Progress is applied directly to the filter-strip DOM node to avoid re-rendering the full map page on every touch-move frame.

## Navigator camera
- Manual map gestures (`pinch zoom`, drag, rotate, pitch) now detach the navigation camera from automatic GPS following.
- GPS position, navigation marker, heading, and route refresh continue updating while the user freely inspects the map.
- The next GPS update no longer snaps zoom/center back after a manual pinch.
- Added a dedicated recenter control above the navigator panel. While detached it is highlighted; tapping it restores GPS follow mode and the proper 3D/scheme camera.
- Changing 3D/scheme while detached preserves the user's current center and zoom instead of forcibly recentering.

## Navigation marker
- Replaced the old turquoise marker with a faceted 3D navigation arrow inspired by the supplied navigator reference.
- The marker is red with brighter/darker facets, a ground shadow, and a subtle red halo while preserving heading rotation.

## Database
- No SQL migration is required for v406.
