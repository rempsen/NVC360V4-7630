# Bug: driver app signs out on iOS background/foreground

## Root cause (confirmed by reading better-auth + bearer plugin source)

1. Auth uses better-auth's bearer-token flow for the mobile app (not cookies).
   `packages/mobile/lib/auth.ts`: `captureToken()` reads the `set-auth-token`
   response header and stores it in SecureStore. `getToken()` reads it back
   and every request sends `Authorization: Bearer <token>`.

2. Server-side (`better-auth/plugins/bearer`), on EVERY authenticated request,
   the bearer plugin's `after` hook inspects `set-cookie` on the response and,
   if present, re-emits `set-auth-token` with a (possibly rotated/renewed)
   session token. This is how better-auth "silently" refreshes/rotates the
   session as it approaches expiry (see api/routes/session.mjs: session
   updateAge/expiresIn logic rotates the cookie + session row periodically).

3. THE BUG: `captureToken()` (in packages/mobile/lib/auth.ts) is ONLY wired
   up as the onSuccess callback on the sign-in call in app/sign-in.tsx:
   `authClient.signIn.email({...}, { onSuccess: captureToken })`.
   It is NOT wired into the authClient's global fetchOptions.onSuccess, so
   every OTHER request (get-session, bookings, riders/me, etc.) that comes
   back with a rotated `set-auth-token` header just... never captures it.
   The client keeps sending the OLD (stale) token from SecureStore forever
   after the first rotation.

4. Why background/foreground specifically triggers it: better-auth's Expo
   client plugin (@better-auth/expo/client.mjs) sets up an ExpoFocusManager
   that listens to AppState and marks the session "focused" again on
   `active`, which triggers `useSession()`'s session-refresh manager to
   immediately refetch `/get-session` (see session-refresh.mjs
   `visibilitychange` handling + focus-manager). That refetch is exactly the
   kind of request whose response may carry a rotated set-auth-token header
   that never gets captured. Once the session on the server has rotated/
   expired past what the stale client-held token corresponds to, the next
   request gets a 401, and the app has no interceptor to react to a 401 by
   signing the user back in seamlessly (there's also no refresh-token /
   silent-relogin fallback) -- so the user is bounced to the sign-in screen.

## Fix plan
1. Move `captureToken` wiring from the one-off sign-in call into
   `authClient`'s global `fetchOptions.onSuccess` in lib/auth.ts, so EVERY
   response (not just sign-in) captures a rotated set-auth-token header.
2. Belt-and-suspenders: also capture from `onError`'s context if a token
   somehow rides along (unlikely but cheap safety) -- skip, not needed given (1).
3. Verify session expiresIn/updateAge server config is sane (check auth.ts on
   web) -- better-auth defaults are 7-day expiry / 1-day updateAge, should be
   fine once rotation is actually captured every time.
4. Typecheck, test, verify build. This is a mobile-only fix (lib/auth.ts) --
   requires a new EAS build + TestFlight submission to actually land for the
   user testing it (JS bundle change but OTA update might also work -- check
   if EAS Update is configured; app.json has an `updates.url` already).

## Status: FIXED
- lib/auth.ts: captureToken now wired into authClient's global fetchOptions.onSuccess
  (was previously only on the one-off sign-in call), so every response — not just
  sign-in — captures a rotated set-auth-token header.
- Confirmed server session config uses better-auth defaults (7d expiry / 1d
  updateAge) — no server-side change needed, this was purely a client-side
  capture gap.
- Typecheck clean (mobile), web tests 112/112 pass (unrelated but re-verified).
- Next: build + submit to TestFlight, verify fix, report back to user.

