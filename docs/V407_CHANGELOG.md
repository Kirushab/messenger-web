# v407 — Navigator travel mode switcher

## Travel modes
- Added a mode switcher for the built route and for active navigation: **Driver** and **Walking**.
- Switching the mode rebuilds the route with the matching Mapbox Directions profile (`driving` or `walking`).
- The active navigation tray now mirrors the selected mode and keeps the control available while navigating.

## Route visuals
- Driver mode keeps the solid blue route styling and uses a car icon in the route preview / navigator tray.
- Walking mode uses a dotted blue route line with a softer casing, plus a pedestrian icon in the preview / navigator tray.
- Route styling is restored correctly after map style changes, including during navigation.

## External map links
- “Open in another app” now forwards the currently selected travel mode to Google Maps, Apple Maps, and Yandex Maps whenever the user opens a route externally.

## Database
- No SQL migration is required for v407.
