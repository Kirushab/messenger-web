# v426 — reactions + poll polish

- Fixed large reaction picker scrub: selected highlight now follows the finger reliably while sliding.
- Removed the stale iOS/Safari :active highlight from the first emoji during a slide gesture.
- Poll create inputs now keep fixed geometry on focus and no longer grow outside the sheet.
- Chat list no longer renders a poll UUID as the last-message preview; it shows a clean “Опрос” preview with an icon.
- No SQL migration required.
