# Fix: DNS verification stuck on "verifying" despite Resend confirming verified

## Root cause (confirmed via live testing against Resend's real API)
bmdmaterials.com DNS records are correct and Resend's own `domains.get()`
reports status: "verified" consistently. BUT our code calls
`resend.domains.verify()` unconditionally on every poll (every 2 min, via
server.ts pollEmailDomains -> triggerVerify) AND on every user click of
"Check verification". Calling verify() on an ALREADY-verified domain
re-triggers a fresh re-validation cycle, which resets Resend's own status to
"pending" for ~10s while it re-checks -- then it settles back to "verified".
Because we call verify() again every 2 minutes (or whenever the user clicks
the button), and then immediately read+persist the status via syncStatus()
right after, we keep catching it mid-reset ("pending") rather than settled
("verified") -- so the DB row/UI never advances out of "verifying".

Confirmed empirically:
- resend.domains.get() alone (no verify() call) -> "verified", stable, records
  all show status "verified".
- resend.domains.verify() then immediate get() -> "pending" (records also
  flip to "pending").
- get() again 10s later -> back to "verified".

## Fix
Only call verify() when the domain is NOT already verified. If Resend
already reports "verified", skip the verify() call entirely and just persist
that status -- never manufacture a fresh re-check on an already-good domain.

services/email-domains.ts:
- triggerVerify(rowId): first call syncStatus() (pure get(), no side effects)
  to see current status. If already "verified", return immediately -- do NOT
  call resend.domains.verify(). Only call verify() when status is
  pending/verifying/not_started/failed, to nudge Resend to re-check DNS.

## Plan
1. Patch triggerVerify() per above.
2. Manually re-run against the real bmdmaterials.com row to confirm the DB
   row flips to "verified" and stays there across multiple poll cycles.
3. tsc, tests, build.
4. Commit + push.
5. Report back to user with root cause + confirmation their domain is now
   showing verified.
