# Notifications UX Audit & Plan

## Summary
Functionality is complete (per-event × per-recipient × 4 channels, plain text + branded HTML email). The friction is **clarity**, not features. Three problem areas, in priority order.

---

## 1. Rules Matrix — "wall of identical icon buttons"
**What's wrong**
- Each row shows 12 near-identical 32px icon buttons (4 channels × 3 recipients). On/off is conveyed only by a subtle fill — fails a glance test.
- Channel meaning relies on hover tooltips. No inline labels.
- The "Edit" message button is pushed off-screen at common widths (table min-width 760px, lots of horizontal scroll).
- No sense of *coverage* — can't quickly answer "which events email the client?"

**Fix**
- Group the 4 channel toggles per recipient into a single **segmented pill** with channel initials + icon, clear ON (filled cyan) vs OFF (ghost) states and a count.
- Sticky first column (Event) + recipient column headers with channel legend pinned.
- Move Edit/Test into a compact row action menu that's always reachable.
- Add a per-recipient "active channels" summary chip (e.g. `In-app · Email`).

## 2. Plain text vs Rich HTML email — ambiguous mode
**What's wrong** (`RecipientCard`)
- A "Branded HTML email" box sits stacked above a "Simple text" textarea with no statement of *which one sends when*. Users don't know HTML applies to the email channel only, and text covers SMS / in-app / email-fallback.
- The relationship is implicit; the email channel toggle is disconnected (top-right) from both content areas.

**Fix**
- Restructure RecipientCard into clearly labeled **channel sections** that only appear when that channel is ON:
  - **Email** → choose mode with a segmented toggle: `Branded HTML` vs `Plain text`. Only the active mode's editor shows. Explicit "If HTML is empty, the plain text below is sent" helper.
  - **SMS / In-app** → the simple text composer, labeled with character feedback.
- Tie each content block to its channel with a header icon + label so there's zero guessing.

## 3. Text / SMS composer + HTML editor polish
**Text composer**
- Add live char count + SMS segment indicator (160 chars = 1 segment) since SMS uses this field.
- Inline preview toggle (already present) kept, but show it as a side-by-side device chip.
- Token chips kept but grouped/tighter.

**HTML editor** (`email-editor.tsx`) — already strong (3-pane, live preview, inspector). Light polish:
- Clarify that Text blocks accept markdown (`**bold**`, `[link](url)`) with a hint in the inspector.
- Keep as-is otherwise; it's the best part of the flow.

---
## Implementation order
1. RecipientCard restructure (biggest clarity win). 
2. Rules matrix segmented toggles + sticky columns.
3. Text composer char/segment feedback.
4. Editor markdown hint.
