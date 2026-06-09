# NVC360 Driver — iOS TestFlight Release

Config is ready. iOS builds run on Expo's servers (not the sandbox), so the
actual build + submit happens through the **Runable mobile preview → Publish**
flow (same place you've been pushing), using the Expo account already linked to
this project.

## What's configured

| Item | Value |
|---|---|
| Display name | **NVC360 Driver** |
| iOS bundle identifier | **com.nvc360.uberize** (permanent) |
| Marketing version | **1.0.0** |
| Build number | auto-incremented by EAS (`appVersionSource: remote`) |
| Push entitlement | `aps-environment: production` |
| Background modes | `location`, `remote-notification` |
| Location perms | always + when-in-use strings set, background location on |
| Camera / Photos perms | set (expo-image-picker) |
| App icon | `assets/icon.png` — 1024×1024, no alpha (App Store compliant) |
| Build resource class | `m-medium` (production/preview/development) |

`eas.json` profiles: `development` (internal dev client), `preview` (internal),
`production` (store build, autoIncrement). Submit profile expects an App Store
Connect API key at `./keys/AuthKey.p8`.

## Steps (Runable Publish flow)

1. Open the **mobile preview dashboard** → **Publish**.
2. Choose **iOS / production** build profile.
3. When prompted for signing, let EAS **manage credentials** (it will create the
   distribution certificate + provisioning profile under your Apple Developer
   account — needs your Apple ID / App Store Connect access). First build for
   `com.nvc360.uberize` will register the App ID automatically.
4. Build runs on Expo's servers (~10–20 min). Result is a `.ipa`.
5. **Submit to TestFlight** — either:
   - Let the Publish flow submit it directly (recommended), or
   - Provide an App Store Connect **API key** (Users & Access → Integrations →
     App Store Connect API → generate key with *App Manager* role). Download the
     `.p8`, place it at `packages/mobile/keys/AuthKey.p8`, and note the **Key ID**
     and **Issuer ID** for `eas submit`.
6. In App Store Connect, the build appears under **TestFlight** after Apple
   processing (~5–15 min). Add internal testers (your team) — no review needed.
   External testers require a quick Beta App Review.

## Notes / gotchas

- **Bundle ID is permanent.** `com.nvc360.uberize` is now locked into App Store
  Connect once the first build registers it.
- **First push test:** APNs uses the `aps-environment: production` entitlement.
  Production push tokens only work on TestFlight/App Store builds (not Expo Go).
- **Background location:** Apple reviewers scrutinize "always" location. The
  usage strings explain the dispatch/ETA use case — keep that justification handy
  if asked during external-tester review.
- **Android mirrors iOS:** package `com.nvc360.uberize` (= iOS bundle ID), same
  name/version/icon. Android `permissions` array now explicitly declares location
  (coarse/fine/background), foreground service (+location), notifications, camera,
  and media — mirroring the iOS capabilities. Ready for a Play Store / internal
  track build via the same Publish flow when you want it.
- Source artwork for the icon: `assets/icon-source.png` (2048², with alpha) if
  you ever need to regenerate.
