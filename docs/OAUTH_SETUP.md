# OAuth App Setup — Google & Microsoft

You only create **ONE app per provider**. Google's single app covers Gmail + Calendar + Drive.
Microsoft's single app covers Outlook + Microsoft 365 + OneDrive.

Current redirect base: `https://nvc360fourdraft.runable.site`
(When you migrate to the branded domain later, just add the new redirect URIs to the same apps.)

---

## 1. GOOGLE  (Gmail + Calendar + Drive)

### A. Create the project & OAuth consent screen
1. Go to <https://console.cloud.google.com/> → top bar → **Select a project** → **New Project** → name it `NVC360` → Create.
2. Left menu → **APIs & Services → OAuth consent screen**.
   - User type: **External** → Create.
   - App name: `NVC360`, support email: your email, developer contact: your email → Save and continue.
   - **Scopes:** Save and continue (we request scopes at runtime).
   - **Test users:** add the Google account(s) you'll connect with → Save. (Until the app is "published/verified," only test users can connect — that's fine for now.)

### B. Enable the APIs (so tokens actually work)
3. Left menu → **APIs & Services → Library**. Search and **Enable** each:
   - **Gmail API**
   - **Google Calendar API**
   - **Google Drive API**

### C. Create the OAuth Client ID
4. Left menu → **APIs & Services → Credentials → + Create Credentials → OAuth client ID**.
   - Application type: **Web application**
   - Name: `NVC360 Web`
   - **Authorized redirect URIs** → Add ALL THREE (one per Google service):
     ```
     https://nvc360fourdraft.runable.site/api/integrations/oauth/callback/gmail
     https://nvc360fourdraft.runable.site/api/integrations/oauth/callback/google_calendar
     https://nvc360fourdraft.runable.site/api/integrations/oauth/callback/google_drive
     ```
   - Create. **Copy the Client ID and Client Secret.**

➡️ Give me these two values:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

---

## 2. MICROSOFT  (Outlook + Microsoft 365 + OneDrive)

### A. Register the app
1. Go to <https://portal.azure.com/> → search **App registrations** → **+ New registration**.
   - Name: `NVC360`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (most flexible).
   - **Redirect URI:** platform = **Web**, value:
     ```
     https://nvc360fourdraft.runable.site/api/integrations/oauth/callback/outlook
     ```
   - Register.
2. After it's created, go to **Authentication** → under "Web → Redirect URIs" → **Add URI** for the other two services:
   ```
   https://nvc360fourdraft.runable.site/api/integrations/oauth/callback/office365
   https://nvc360fourdraft.runable.site/api/integrations/oauth/callback/onedrive
   ```
   - Save.

### B. Add API permissions (delegated)
3. Left menu → **API permissions → + Add a permission → Microsoft Graph → Delegated permissions**. Add:
   - `User.Read`
   - `Mail.Send`
   - `Calendars.ReadWrite`
   - `Files.ReadWrite`
   - `offline_access`
   - Add permissions. (Personal accounts don't need admin consent for these.)

### C. Create a client secret
4. Left menu → **Certificates & secrets → + New client secret** → description `NVC360`, expiry 24 months → Add.
   - **Copy the secret VALUE immediately** (not the Secret ID — the Value, shown only once).
5. Go to **Overview** → copy the **Application (client) ID**.

➡️ Give me these two values:
- `MICROSOFT_CLIENT_ID`  (the Application/client ID)
- `MICROSOFT_CLIENT_SECRET` (the secret **Value**)

---

## After you send me the 4 values
I'll drop them in the server env and restart. The cards flip from "Set up" → "Connect," and clicking Connect opens the real Google/Microsoft login. Once you approve, the card shows **Live** with your account email.
