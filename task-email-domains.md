# Self-serve Resend domain verification

## Decisions
- Full automation via Resend Domains API (paid plan, full key).
- Flow: tenant SUBMITS domain -> superadmin APPROVES/creates in Resend -> records shown -> tenant adds DNS -> verify (auto-poll).
- E2E test domain: bmdmaterials.com (company bmd-materials).

## Plan
- [ ] DB: tenant_email_domains table (companyId, domain, resendDomainId, status, region, records JSON, lastCheckedAt, createdBy, createdAt). Migration.
- [ ] Service: services/email-domains.ts wrapping resend.domains (create/get/verify/list/remove) + DB sync + record normalization.
- [ ] Routes (tenant): notif-config -> GET my domains, POST submit domain, POST :id/check (re-verify), DELETE :id.
- [ ] Routes (superadmin): list pending, POST approve (creates in Resend), POST :id/verify, DELETE.
- [ ] Poller: server.ts setInterval re-checks pending/unverified domains -> flips to verified.
- [ ] Send guard: dispatch.ts/email.ts only use tenant from-address if its domain is VERIFIED, else fallback.
- [ ] UI tenant: notifications.tsx Email sender panel -> domain status, submit, copy DNS records, check button, badge.
- [ ] UI superadmin: pending domains queue -> approve/verify.
- [ ] Verify: tsc, build, restart, screenshot. E2E with bmdmaterials.com.
- [ ] Remind Publish.
