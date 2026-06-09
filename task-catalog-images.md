# Catalog preset images — full coverage (180 items)

Pipeline per item: web_search(type:images) → download best to /home/user/Images/<slug>.jpg → upload → paste URL into catalog-presets.ts `image:`.

## Industries (12 items each)
- [x] hvac
- [x] plumbing
- [x] electrical
- [x] restoration
- [x] appliance
- [ ] courier
- [ ] security
- [ ] telecom
- [ ] roofing
- [ ] landscaping
- [ ] construction
- [ ] waste
- [ ] utility
- [ ] healthcare
- [ ] municipal

## After images done
- [ ] re-seed/update DB rows with images for existing tenants (UPDATE catalog_items SET image where company industry matches & sku matches)
- [ ] bunx tsc --noEmit + oxlint + vite build
- [ ] restart web tmux, screenshot catalog
- [ ] remind user to Publish

## COMPLETE — all 15 industries
- [x] hvac, plumbing, electrical, restoration, appliance, courier
- [x] security, telecom, roofing, landscaping, construction
- [x] waste, utility, healthcare, municipal
- 180/180 preset items have hosted image URLs (0 empty).
- DB backfill done: 37 existing catalog_items rows updated (default/acme-hvac/bolt-plumbing/bmd-materials). 3 custom flooring rows on `default` intentionally left (not preset items).
- tsc OK, oxlint 0 warnings, vite build OK. Web restarted on :4200 (HTTP 200).
- Sample image URLs verified HTTP 200 live.
- PENDING: user must Publish to push all session changes live.
