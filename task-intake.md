# Intake Forms module — robust builder

## Decisions
- Own nav item "Intake Forms" -> /admin/intake-forms (standalone page, pull out of API Access)
- Field types: text, textarea, email, phone, number, select, radio, checkbox, date, address, file
- Sections: array of {id,title,description}; fields reference sectionId
- Custom fields: id,key,type,label,placeholder,options[],required,enabled,sectionId,width
- Recipient master section: recipientName + recipientEmail -> primary "to" on submission email, AND still create pipeline lead
- Permissions: any tenant admin can create/edit/delete their own (was superadmin-only)
- Backward compat: old [{key,label,enabled,required}] still loads; normalize on read

## Plan
- [ ] Schema: add recipientName, recipientEmail, sections (JSON) to intakeForms. Migration.
- [ ] forms.ts: relax create/patch/delete to requireAdmin; accept sections, recipient*, rich fields
- [ ] public-forms.ts GET: return sections + rich fields + recipient(name only, not email) ; SUBMIT: collect all custom answers, validate required, email recipient + create lead
- [ ] email: send submission summary to recipientEmail (primary to)
- [ ] intake-form.tsx (public render): render sections + every field type dynamically
- [ ] admin/intake-forms.tsx: new standalone page; rich editor (add section, add field, pick type, options, required, recipient master panel)
- [ ] shell.tsx nav: add Intake Forms item
- [ ] app routing: ensure /admin/intake-forms renders new page; remove section from api-access
- [ ] tsc, build, restart, screenshot, E2E
- [ ] Remind Publish

## DONE ✅ (E2E verified 2026-06-06)
- Schema + migration 0002 pushed (sections, recipientName, recipientEmail)
- forms.ts rewritten (requireAdmin, normalize, sections+recipient in mask)
- public-forms.ts: GET returns sections; SUBMIT collects custom answers, validates required, stores in booking notes + field_data.custom, emails recipient (primary to) + creates lead
- intake-form.tsx public renderer: ALL field types render (text/email/phone/select/radio/checkbox/date/textarea/address/file), sections grouped, half/full widths — SCREENSHOT VERIFIED ✓
- admin/intake-forms.tsx standalone builder page + nav item + route
- api-access.tsx: removed inline section, added link card
- E2E: submitted real form via public key → 201, lead created with custom field_data, recipient email sent (silent success, no error in log) ✓
- Test row + bookings cleaned up
- tsc clean, vite build clean, web 200
