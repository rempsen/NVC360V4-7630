#!/usr/bin/env python3
"""
End-to-end smoke test: the admin login flow.

Drives a REAL headless Chromium against the running web app (default
http://localhost:4200) and verifies the critical happy path that every admin
hits first:

  1. The /sign-in page renders ("Welcome back").
  2. Entering valid superadmin credentials and submitting...
  3. ...authenticates and redirects into the protected /admin console shell.

This is intentionally one focused E2E (login -> protected redirect) rather than
a broad suite: it exercises the full stack together — React SPA routing, the
Better-Auth sign-in endpoint, session token capture, and the ProtectedRoute
gate — which unit/integration tests can't cover.

Usage:
    BASE_URL=http://localhost:4200 \\
    E2E_EMAIL=dan@nvc360.com E2E_PASSWORD='NVC423!!' \\
    python3 e2e/login.e2e.py

Requires: python3 -m playwright install chromium
Exit code 0 = pass, non-zero = fail.
"""
import os
import sys
from playwright.sync_api import sync_playwright, expect, TimeoutError as PWTimeout

BASE_URL = os.environ.get("BASE_URL", "http://localhost:4200")
EMAIL = os.environ.get("E2E_EMAIL", "dan@nvc360.com")
PASSWORD = os.environ.get("E2E_PASSWORD", "NVC423!!")


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(15_000)
        try:
            # 1. Sign-in page renders.
            page.goto(f"{BASE_URL}/sign-in", wait_until="networkidle")
            expect(page.get_by_text("Welcome back")).to_be_visible()
            print("[1/3] sign-in page rendered OK")

            # 2. Fill credentials and submit.
            page.get_by_placeholder("Email address").fill(EMAIL)
            page.get_by_placeholder("Password").fill(PASSWORD)
            page.get_by_role("button", name="Sign in").click()
            print("[2/3] submitted credentials")

            # 3. Redirect into the protected /admin console.
            page.wait_for_url("**/admin**", timeout=15_000)
            assert "/admin" in page.url, f"expected /admin, got {page.url}"
            # The protected shell must actually render (not bounce back to sign-in).
            expect(page.get_by_text("Welcome back")).to_have_count(0)
            print(f"[3/3] redirected into protected console: {page.url}")

            print("\nPASS: admin login E2E")
            return 0
        except (AssertionError, PWTimeout) as e:
            print(f"\nFAIL: {e}", file=sys.stderr)
            try:
                page.screenshot(path="/tmp/e2e-login-fail.png")
                print("screenshot saved to /tmp/e2e-login-fail.png", file=sys.stderr)
            except Exception:
                pass
            return 1
        finally:
            browser.close()


if __name__ == "__main__":
    sys.exit(main())
