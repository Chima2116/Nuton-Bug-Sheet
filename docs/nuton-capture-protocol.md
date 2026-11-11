# Nuton capture protocol (v1)

Messages between the Bug Sheet (opener) and the capture module inside Nuton (popup). Used with `window.postMessage`.

**Start.** The Bug Sheet opens `https://nuton.app/new#nuton-capture=<session>&origin=<bugSheetOrigin>&v=1`.
The fragment is never sent to a server. Nuton reads it, removes it with `history.replaceState`, and only starts capture mode if
`origin` is on its allow-list and `window.opener` exists. `<session>` is a random 128-bit value that pairs the two windows. It is not a login.

All messages carry `{ source, v: 1, session }`. Every `postMessage` names an exact target origin (never `"*"`), and every receiver checks
`event.origin`, `event.source` and `session` before reading anything else.

| From → to | `source` | `type` | Payload |
| --- | --- | --- | --- |
| Nuton → Bug Sheet | `nuton-capture` | `ready` | |
| Bug Sheet → Nuton | `bug-sheet` | `ack` | `count` (screenshots already on the draft) |
| Nuton → Bug Sheet | `nuton-capture` | `shot` | `shot: { id, original: Blob(png), annotated: Blob(png) \| null, meta }` |
| Bug Sheet → Nuton | `bug-sheet` | `shot-received` / `shot-failed` | `id`, `count` |
| Bug Sheet → Nuton | `bug-sheet` | `count` | `count` |
| Nuton → Bug Sheet | `nuton-capture` | `closed` | |
| Nuton → Bug Sheet | `nuton-capture` | `refused` | The signed-in Nuton account is not on the allow-list. Nuton then behaves as a normal page. |

`meta` = `{ path, title, capturedAt, browser, os, screen, viewport, approximate? }`. `path` has no query string or hash. Nothing else is sent:
no cookies, no storage, no tokens.

Limits: images must be `image/png`, at most 25 MB each. Anything else is ignored by the Bug Sheet.
