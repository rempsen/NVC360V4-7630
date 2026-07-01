# NVC360 UI Polish Task

## Audit Findings

### MARKETING SITE (localhost:4200 / landing page)
**Issues:**
1. Hero section spacing is uneven — too much empty space below CTAs before stat bar
2. Feature cards (Platform section): uniform rounded-2xl + thin border = generic AI look. Need depth layering
3. Section labels ("PLATFORM", "INTEGRATIONS") are just teal text — could use subtle pill badges
4. Stats row ("20%", "800+", "1B") lacks visual weight — just numbers on dark bg, no card context
5. Integration logos in cards are too uniform — boring grid with no visual rhythm
6. Pricing cards: center card highlighted but not enough — barely distinguishable
7. Hero typography: "love you." line in cyan is too big at 60px with no letter-spacing tightening
8. No scroll animations / entrance transitions — page feels static
9. Nav: no active state differentiation

### SIGN-IN PAGE
**Issues:**
1. Left panel is solid dark gradient — could use a subtle grid/pattern texture
2. Input fields have large border-radius (pill shape) — inconsistent with the dashboard cards which are more rectangular
3. Sign In button full cyan — works but could use gradient direction for depth
4. "Welcome back" heading is boxy — needs letter-spacing refinement

### DASHBOARD (Admin)
**Issues:**
1. Sidebar nav: ALL items look same weight — no active state visual pop beyond bg color. Active item needs left accent bar
2. KPI cards: icon + large number layout is ok but numbers have no color differentiation — all same treatment
3. KPI cards: dollar icon size too large relative to the number — awkward proportion
4. "OPERATIONS", "CATALOG & FORMS", "PEOPLE" section labels are tiny uppercase tracking — barely readable
5. Recent work orders list: dense, no row separators, status badges are ok but address text wraps awkwardly
6. Fleet status panel: status dot labels ("En Route", "Available") look like random tag soup
7. Stat cards have generic purple/teal/green icons inside squares — no depth or brand personality
8. Chat button (bottom-right cyan circle) clashes slightly — needs subtle shadow
9. Overall: padding inconsistencies across panels, some 20px some 32px
10. Work order rows: amount is right-aligned but service type below it is a very small subdued text — loses info hierarchy

## Priority Changes (ordered by impact)

### P0 — Dashboard (most used screen)
1. **Sidebar active state**: Add left 2px cyan accent bar + slightly brighter text + bg to active item
2. **KPI cards**: Add subtle top border color per-card (different accent), larger number weight, icon right-aligned
3. **Recent work orders**: Better row padding, stronger status badge contrast, amount as primary not secondary
4. **Fleet status**: Status indicator cleanup — pill badges with dot+label, better grouping

### P1 — Marketing/Landing
1. **Feature cards**: Add hover lift + subtle inner-glow border on hover  
2. **Pricing cards**: Center card gets glow border + slight scale
3. **Section labels**: Pill badge style (bg/10 border accent)
4. **Stats bar**: Card treatment with subtle borders

### P2 — Sign-in
1. Left panel texture / grid overlay
2. Input border-radius standardization (rounded-lg not rounded-full)

## Files to touch
- packages/web/src/web/pages/admin/dashboard.tsx — KPI cards, work orders list, fleet status
- packages/web/src/web/components/sidebar.tsx (or layout) — sidebar active state
- packages/web/src/web/pages/landing/ or index.tsx — feature cards, pricing, stats
- packages/web/src/web/pages/sign-in.tsx — inputs, button
- packages/web/src/index.css or tailwind config — global type scale

## Status
- [ ] Audit done
- [ ] Sidebar polish
- [ ] Dashboard KPI cards
- [ ] Work orders rows
- [ ] Feature cards hover
- [ ] Pricing card glow
- [ ] Sign-in inputs
- [ ] Build + verify
