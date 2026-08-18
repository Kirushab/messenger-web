# v428 — video note / stories / selection polish

## Video note camera
- Recording now uses a stable canvas capture stream when supported.
- Camera flip changes only the preview source, so MediaRecorder is not stopped by track replacement.
- The next camera is warmed before the old camera is stopped, with a small visual transition.
- A safe applyConstraints fallback is used on browsers without canvas capture.

## Stories
- Raised the StoryViewer header/menu stacking context above the linked-event chip.

## Message selection
- Removed full-row green selected background.
- Selection is indicated by circular checkmarks only.

## Database
- No SQL migration required.
