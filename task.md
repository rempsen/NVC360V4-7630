# Push notifications + app badge for dispatcher -> driver messages

## Root cause found
Job-status events (assigned/enroute/etc, via dispatch.ts fireEvent) already
call sendPush() correctly — that's why those show up as banners even when the
app is backgrounded/closed. But the actual chat/messaging routes in
messages.ts (POST /dispatch/:techId direct message, POST /broadcast) NEVER
call sendPush() at all — they only insert a `notifications` DB row, which is
only visible if the user opens the app and looks. That's the whole bug: no
push = no banner when backgrounded/closed, and no APNs badge count sent
either (push.ts's PushMessage type has a `badge` field but nothing ever
populates it).

## Fix
1. push.ts: sendPush() accepts an optional `badge` count, forwarded to Expo's
   push payload (badge is what sets the iOS app-icon number; Android best-effort
   depending on launcher, but the in-tray count updates regardless).
2. messages.ts: add unreadDirectCountForRider() helper (mirrors the existing
   /direct/unread query). Call sendPush() with this badge count from:
   - POST /dispatch/:techId (dispatcher -> single tech)
   - POST /broadcast (dispatcher -> many techs)
3. Mobile: keep the OS badge in sync locally too (belt & suspenders in case a
   push is delayed/coalesced) — call Notifications.setBadgeCountAsync() from
   the existing unread-count query in (rider)/_layout.tsx, and reset to 0 when
   the direct thread is read (messages.tsx).
4. push tap handling: route to the Messages tab when a message push (no
   bookingId) is tapped.

## Scope decision
Scoped to the direct dispatcher<->tech thread (the "Messages" tab) — this
matches exactly what the user described and is the only thread with reliable
per-tech unread tracking already built. Job-thread (per-booking, 3-party)
messages have a single shared `read` flag with no per-viewer semantics; adding
per-tech unread tracking there would require a schema change and touches
customer/dispatch flows too — flagged as a possible follow-up, not done here
to avoid destabilizing a live production read-tracking behavior.

## Status: IN PROGRESS
