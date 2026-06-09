# Build & Submit NVC360 Driver to TestFlight — local eas-cli runbook

Runable can't run native iOS builds (they execute on Expo's servers under your
authenticated account). Run these on **your own machine**.

## Current state (already wired — don't redo)
- App in App Store Connect exists: `ascAppId = 6776464675`
- ASC API key configured: `ascApiKeyId = 6Y6Z8B2F66`, issuer `e5beafb9-...`
- Bundle ID / Android package: `com.nvc360.uberize`
- Name: **NVC360 Driver**, version `1.0.1`, build number auto-incremented by EAS
- `submit.production.ios.ascApiKeyPath = ./keys/AuthKey.p8`

## 0. Prereqs on your machine
- Node 18+ and `npx` (or `npm i -g eas-cli`)
- The repo cloned, or at least `packages/mobile/` with `node_modules` installed
  (`cd packages/mobile && npm install` or `bun install`)
- **The API key file present at `packages/mobile/keys/AuthKey.p8`.**
  It exists in the sandbox but NOT on your laptop. Get it there securely:
  - In App Store Connect → Users and Access → Integrations → App Store Connect
    API: the key `6Y6Z8B2F66` is listed. (Apple only lets you download a `.p8`
    ONCE at creation — if you didn't save it, generate a NEW key, then update
    `ascApiKeyId`/`ascApiKeyIssuerId` in eas.json to match.)
  - OR copy it from this repo's `packages/mobile/keys/AuthKey.p8` over a secure
    channel (scp / private transfer). Never paste a private key into chat.

## 1. Log in to Expo
```
cd packages/mobile
npx eas-cli login          # the Expo account linked to this project
```
First time only — link the project (creates owner + projectId in app.json):
```
npx eas-cli init           # accept linking to the existing project if prompted
```

## 2. Build the iOS app (runs on Expo servers ~10–20 min)
```
npx eas-cli build --platform ios --profile production
```
- When asked about credentials: choose **"Let EAS handle it"** → sign in with
  your **Apple Developer Apple ID** when prompted. EAS auto-registers the App ID
  and creates the distribution cert + provisioning profile.
- Wait for **"Build finished"** and a `.ipa` URL.

## 3. Submit to TestFlight
```
npx eas-cli submit --platform ios --latest --profile production
```
- Uses the ASC API key in eas.json — no Apple password needed for this step.
- On success, the build shows in App Store Connect → **NVC360 Driver →
  TestFlight** as **Processing** (5–15 min, occasionally up to an hour).

## 4. Make it testable on your iPhone
1. App Store Connect → NVC360 Driver → **TestFlight** tab.
2. If it shows **"Missing Compliance"**, click it and answer the export-
   encryption question (HTTPS-only apps → "uses standard encryption / exempt").
3. **Internal Testing** → add the **exact Apple ID that's signed into the
   TestFlight app on your iPhone**. (This was the gap before — the phone's
   TestFlight was on a different Apple ID than the invited tester.)
4. Open **TestFlight** on the iPhone (same Apple ID) → NVC360 Driver appears →
   **Install**.

## Troubleshooting
- **`build` errors on credentials:** make sure your Apple ID has Admin/App
  Manager role and the Developer Program membership is active.
- **`submit` "Invalid API key":** the `.p8` doesn't match `ascApiKeyId`/issuer,
  or the file is missing. Regenerate the key and update eas.json.
- **Build never appears in ASC:** you ran `build` but not `submit` (step 3).
- **App in ASC but no build:** same — submit step missing or it errored.
- **Not in phone TestFlight:** tester Apple ID ≠ phone's TestFlight Apple ID, or
  build still "Processing", or "Missing Compliance" not answered.

## One-liner (after login + key in place)
```
cd packages/mobile && npx eas-cli build -p ios --profile production && \
  npx eas-cli submit -p ios --latest --profile production
```
