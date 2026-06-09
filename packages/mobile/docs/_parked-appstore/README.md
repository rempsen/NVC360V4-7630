# 🅿️ App Store track — PARKED (resume next week)

We paused App Store / TestFlight to focus on multitenant stability + online app
integrations. **Nothing was deleted — everything is ready to resume.**

## Still intact (don't touch)
- `app.json`: name "NVC360 Driver", bundle ID / Android package `com.nvc360.uberize`,
  version 1.0.1, push entitlement, background location, permissions, 1024² icon.
- `eas.json`: production build profile + ASC submit creds (ascAppId 6776464675,
  key 6Y6Z8B2F66) and `keys/AuthKey.p8`.
- `scripts/ship-ios.sh`: the one-command build+submit helper.

## What we changed to pause
- Renamed the npm scripts to `_paused_ship:ios`, `_paused_build:ios`,
  `_paused_submit:ios` so they aren't run by accident this week.
- Moved the guides here: START_HERE.md, RUN_BUILD_LOCALLY.md, IOS_RELEASE.md.

## For now: Expo Go
- Run `npm run go` (or `npm start`) to launch in Expo Go.
- Keep using the Runable Publish flow for Expo Go pushes as before.

## To RESUME next week
1. In `package.json`, rename the scripts back (remove the `_paused_` prefix):
   `ship:ios`, `build:ios`, `submit:ios`.
2. Open `START_HERE.md` here and follow it. (The easy button is `npm run ship:ios`.)
