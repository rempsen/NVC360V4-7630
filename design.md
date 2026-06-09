# HomeServe — Design Direction

Inspired by a clean medical/healthcare layout: airy, trust-driven, photo-forward, blue primary.

## Brand
- **Name:** HomeServe
- **Vibe:** Professional, trustworthy, calm, modern. Healthcare-grade clean.

## Color
- **Primary:** `#2563EB` (blue-600) — buttons, links, active states
- **Primary deep:** `#1E40AF` (blue-800) — gradients, headers
- **Accent:** `#0EA5E9` (sky-500) — highlights, live/tracking
- **Success:** `#16A34A` | **Warning:** `#F59E0B` | **Danger:** `#DC2626`
- **Backgrounds:** white `#FFFFFF`, soft `#F8FAFC` (slate-50), card borders `#E2E8F0`
- **Text:** `#0F172A` (slate-900) headings, `#475569` (slate-600) body, `#94A3B8` muted

## Typography
- **Display/Headings:** "Plus Jakarta Sans" — bold, tight tracking
- **Body:** "Inter"... NO. Use **"Plus Jakarta Sans"** for headings + **"DM Sans"** for body.
- Generous line-height (1.6 body), large hero headings (clamp 2.5–4rem).

## Layout
- Lots of white space, rounded cards (radius 16–20px), soft shadows (`0 4px 24px rgba(15,23,42,0.06)`).
- Hero: photo + gradient blue panel, headline left, image right.
- Service tiles: icon-led grid, hover lift.
- Booking form styled like an appointment card — white card on soft bg, blue submit.
- Tracking: full map with live rider marker, ETA card overlay.

## Motion
- Staggered fade-up on page load. Hover lifts on cards/buttons. Smooth map marker transitions.

## Roles & shells
- **Customer:** marketing landing → book → track → history. Bottom-light nav.
- **Rider:** job queue, active job with map + status buttons, earnings.
- **Admin:** sidebar dashboard — bookings table, assign riders, services, users, revenue.
