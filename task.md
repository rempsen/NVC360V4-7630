# Fix: messages incorrectly auto-marked "read" by background polling

## Root cause (confirmed)
Three GET endpoints mark messages as `read` as a SIDE EFFECT of merely being
fetched:
- GET /api/messages/direct (rider's own thread)
- GET /api/messages/dispatch/:techId (dispatcher viewing one tech, via
  DispatchMessenger ChatView, polls every 4s)
- GET /api/fleet/:techId/thread (fleet map chat drawer, ALSO polls every 4s)

All three are polled continuously by React Query while their component is
mounted -- including while backgrounded/unfocused. So messages get marked
read moments after arriving, regardless of whether a human ever looked.
This explains BOTH user reports:
1. iOS badge not clearing after reading -- inverse timing gap, badge sync
   lagged the poll.
2. Dispatcher chat icon never showing unread -- if the fleet ChatDrawer OR
   DispatchMessenger chat view for that tech had ever been opened (even
   earlier, even backgrounded), it kept silently marking new tech messages
   read on every subsequent poll, before the badge could ever register them.

## Fix
Separate "fetch" from "mark read": GETs become pure reads. Add explicit
POST .../mark-read endpoints, called ONCE by the frontend when a human
actually opens/focuses that specific thread -- never from a poll.

1. Backend (messages.ts):
   - GET /direct: remove auto-mark-read.
   - NEW POST /direct/mark-read (rider explicitly acks reading dispatch's messages)
   - GET /dispatch/:techId: remove auto-mark-read.
   - NEW POST /dispatch/:techId/mark-read (dispatcher explicitly acks)
2. Backend (fleet.ts):
   - GET /:techId/thread: remove auto-mark-read.
   - NEW POST /:techId/thread/mark-read
3. Frontend web (dispatch-messenger.tsx ChatView): call mark-read once via
   useEffect keyed on tech.techId (on open), NOT tied to the poll.
4. Frontend web (fleet.tsx ChatDrawer): same treatment via api.fleet mark-read.
5. Mobile (messages.tsx): call mark-read once on screen focus
   (useFocusEffect), not from the 5s poll. Also immediately call
   setAppBadgeCount(0) right after a successful mark-read so the OS badge
   clears deterministically instead of waiting for the next _layout.tsx poll.
6. Re-verify end to end: insert unread message, confirm poll does NOT clear
   it, confirm explicit mark-read call DOES clear it and only it.
7. tsc, tests, build for web; tsc for mobile.
8. Regenerate + hand off new access code for the "Work Orders" form
   (converted last turn from lead->work_order type, which reset its PIN).

## Status: IMPLEMENTING
