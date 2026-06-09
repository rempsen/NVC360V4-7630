# 📱 Get NVC360 Driver onto your iPhone — Start Here

Plain-English guide. No coding needed. Three things, in order.

---

## ✅ One-time setup (do once)

You need two things on your computer:

1. **Node.js** — free, from https://nodejs.org → download the big "LTS" button →
   install it (just keep clicking Next).
2. **The Apple key file** — a small file named `AuthKey.p8` must sit in the
   folder `packages/mobile/keys/`.
   - If it's already there, great.
   - If not: in App Store Connect → *Users and Access* → *Integrations* →
     *App Store Connect API*, create a key (role **App Manager**), download the
     `.p8`, and put it in that `keys` folder. (Ask your dev to update the Key ID
     in `eas.json` if you made a new one.)

---

## 🚀 Build & send to TestFlight (the easy button)

Open the **Terminal** app, then copy-paste these two lines (press Enter after):

```
cd path/to/packages/mobile
npm run ship:ios
```

> Replace `path/to` with where the project lives on your computer. Tip: type
> `cd ` (with a space), then drag the `mobile` folder into the Terminal window —
> it fills in the path for you. Then press Enter.

That's it. The helper will:
- check everything is ready,
- log you into Expo (use the account connected to this app),
- build the app (~10–20 min — you can walk away),
- upload it to TestFlight,
- and print exactly what to do next.

**If it asks about signing during the build:** choose **"Let EAS handle it"** and
sign in with your **Apple Developer** Apple ID.

---

## 📲 Final step on Apple's side (after the upload)

1. Go to https://appstoreconnect.apple.com → **Apps → NVC360 Driver →
   TestFlight**. The build shows **"Processing"** for ~5–15 min. Wait.
2. If you see **"Missing Compliance"**, click it → choose the
   *"uses standard encryption / exempt"* answer.
3. **TestFlight → Internal Testing → add a tester.**
   ⚠️ Use the **exact same Apple ID** that's signed into the **TestFlight app on
   your iPhone**. (This was the earlier mix-up — the phone was on a different
   Apple ID than the invited tester, so nothing showed up.)
4. Open **TestFlight** on the iPhone → **NVC360 Driver** appears → **Install**. 🎉

---

## 🆘 If something goes wrong

The helper stops and tells you what to fix in plain words. A few quick ones:

| What you see | What it means | What to do |
|---|---|---|
| "App Store Connect key is missing" | The `AuthKey.p8` file isn't in `keys/` | Put the file there (see setup) |
| Build error mentioning Apple/credentials | Apple sign-in issue | Make sure your Apple Developer membership is active; rerun `npm run ship:ios` |
| Build worked but upload failed | Key/IDs mismatch | Run just the upload: `npm run submit:ios` |
| Nothing in TestFlight on the phone | Wrong Apple ID, or still "Processing" | Match the Apple ID (step 3 above) and wait |

**Re-running is safe.** `npm run ship:ios` skips steps already done.

Just need to retry one part?
- Rebuild only: `npm run build:ios`
- Upload only: `npm run submit:ios`
