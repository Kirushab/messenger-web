# v418 — multiline Story comments

## Stories
- Story comment field is now a multiline textarea.
- Enter inserts a new line instead of sending the comment.
- Sending is done only with the dedicated send button.
- The field grows smoothly up to two lines / 104px and then becomes internally scrollable.
- After sending, the composer collapses back to its default height.

## Database
- No SQL migration required. Migration 177 from v417 remains unchanged.
