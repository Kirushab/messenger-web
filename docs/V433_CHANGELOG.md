# v433 — Chat TDZ crash fix

- Fixed production runtime crash when opening/restoring a chat: `Cannot access ... before initialization`.
- `conv` is now resolved before the attachment-focus effect and all other hook dependency arrays that reference it.
- No database migration required.
