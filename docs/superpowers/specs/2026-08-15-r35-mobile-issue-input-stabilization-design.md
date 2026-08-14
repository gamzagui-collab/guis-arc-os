# R35 Mobile Issue Input Stabilization Design

## Goal

Stabilize the r34 zero-touch Issue input flow on real mobile devices without changing Worker, API, database, Location Master, submit, permission, or speech-recognition infrastructure.

## Scope and boundaries

- Fix empty manual content/detail ownership so a later speech result can fill a genuinely empty field.
- Warn about tracked unresolved structural speech tokens without blocking registration or inventing canonical locations.
- Present unresolved structural tokens between canonical location and detail in the live final sentence while preserving them in payload content.
- Compress the photo editor, add a canvas cloud tool, and replace the color select with an accessible four-color palette.
- Compress only the mobile location/content layout.
- Compact the active shared-photo watermark through the existing List/Photo View pipeline.
- Synchronize active frontend references to `v0.27.1-r35` and cache `guis-arc-integrated-v0.27.1-r35-shell`.
- Do not deploy, commit, push, create a ZIP, or update official version/project-state documents.

## Draft ownership and unresolved location

`IssueDraft` remains the single source of truth. `setManualContent` and `setManualDetail` normalize trimmed empty input to `{ text: "", source: "NONE" }`; non-empty input remains `MANUAL`. `mergeSpeechCandidateIntoDraft` keeps the existing `MANUAL > SPEECH > NONE` precedence.

Only tokens already tracked in `draft.unresolvedStructural` may be highlighted, warned about, promoted in the final sentence, or removed after canonical manual resolution. The raw transcript and payload description retain unresolved information. No regex-based inference, canonical creation, cross-parent lookup, or registration blocking is added.

The display-only sentence order is canonical BUILDING/FLOOR/UNIT, tracked unresolved structural tokens, detail, and content with only the exact displayed tracked occurrences omitted to prevent duplication. Direct user edits never cause deleted tokens to be restored.

## Photo editor

The toolbar is divided into operation, shape, and history groups. Mobile operation controls place photo scrolling, the palette, and line width in the first row when they fit. If a real 320px render cannot fit while preserving touch targets, line width alone wraps; the four palette colors never split or scroll horizontally.

The palette uses native buttons with `aria-pressed`, Korean labels, and exactly one selected color. The four colors are red `#e11d2e`, yellow `#f4cf22`, blue `#1769e0`, and white `#ffffff`; red is the default. Every button keeps a minimum 44×44px hit area around a compact circular swatch. Selection uses a heavy outline plus a check, and white has a gray boundary. Button click or keyboard activation updates the active canvas stroke immediately.

Ellipse is removed. Circle, rectangle, line, arrow, pen, and scroll remain. Cloud is a closed canvas path built from curves inside the drag bounding box and uses the current color and width. Existing minimum drag, undo, clear, pointer-cancel, and touch-action behavior remains.

## Mobile location and content layout

At mobile widths, BUILDING/FLOOR/UNIT occupy one grid row with visible labels and proportions approximately `1.45fr .72fr 1.15fr`. Detail occupies the next row; suggestions wrap safely; direct mode is separated by a divider. Content defaults to roughly two visible lines, remains required with `maxlength=4000`, and can internally scroll. Desktop layout is preserved.

## Shared-photo watermark

The active `issueShareDisplay` → `issueShareWatermarkLayout` → `createSharePhoto` route remains common to List and Photo View. It renders canonical location and KST date on line 1, then detail/content on at most two lines. The 10:8:6 type ratio remains; the active black layer alpha becomes `.58`; padding and gaps are compact without clipping portrait, landscape, or small images.

## Accessibility and validation

Unresolved warnings use semantic DOM nodes and live/status semantics, never unsafe HTML concatenation. Color, tool, width, location, content, direct-mode, and registration controls remain keyboard accessible and at least 44px where required. Automated contracts cover state and geometry, while real rendering must separately verify `scrollWidth <= clientWidth` at 320, 360, and 412px. Automated tests are not reported as real microphone or real-device speech PASS.

## Resource impact

Frontend and frontend tests only. Worker, API, D1, R2, migrations, Location Master, Production, Integration deployment, Issue persistence, commit, and push are out of scope.
