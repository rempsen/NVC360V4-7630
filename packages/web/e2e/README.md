# E2E tests

Browser-driven end-to-end tests against a **running** web server. These cover
full-stack happy paths (SPA routing + auth endpoints + protected routes) that
unit/integration tests can't reach.

## Tooling

Uses **Python Playwright** (the Node Playwright in this repo is broken; Python
works). Chromium is already installed in the sandbox.

One-time (already done here):
```
python3 -m playwright install chromium
```

## Running

1. Start the web server (defaults to port 4200):
   ```
   cd packages/web && bun src/server.ts
   ```
2. Run a test (headless, via xvfb):
   ```
   cd packages/web
   BASE_URL=http://localhost:4200 \
   E2E_EMAIL=dan@nvc360.com E2E_PASSWORD='YOUR_PASSWORD' \
   xvfb-run -a python3 e2e/login.e2e.py
   ```

Exit code `0` = pass. On failure a screenshot is saved to `/tmp/e2e-login-fail.png`.

## Tests

- **login.e2e.py** — admin login flow: `/sign-in` renders → submit valid
  superadmin credentials → redirected into the protected `/admin` console.
