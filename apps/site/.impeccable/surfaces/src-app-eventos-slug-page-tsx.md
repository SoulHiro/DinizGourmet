---
version: 1
slug: "src-app-eventos-slug-page-tsx"
primary_target: "src/app/eventos/[slug]/page.tsx"
related_targets: []
---

## Scope

Persuade surface. Public event landing page, `/eventos/[slug]`. One event per page, content driven by the `event` DB row (name, attraction, date, time, location, description). Audience: Instagram traffic, mobile-first, deciding in seconds whether to reserve a table. Must stay untouched: the reservation form's three fields (name, WhatsApp, party size) and its plain-server-action submit flow; existing DB schema and public route structure.

## Direction contract

THESIS: This is a printed event poster that happens to run in a browser, not a restaurant website with an event section bolted on — every viewport reads like a single composed sheet (edge-to-edge bleed, layered type over photography), refusing the card-grid "features of our restaurant" template.

OWN-WORLD: Ground `#1c1108` near-black-brown (`#291A0C` family) with layered vignette depth, never flat. Type: a serif display with real character (Playfair Display or equivalent) set large and tight for names/headlines, Montserrat for body/UI/labels. Gold/amber (`#C9A227`, `#ED9316`) carries headlines, rules, borders, primary CTA; burnt orange/terracotta (`#BC430D`) reserved for small badges and hover accents only. Cream/warm-white body text, never pure white. Subtle film-grain + paper/wood-grain texture as a fixed overlay, never blocking legibility. Circular badge logo treated as a seal — fixed aspect, generous negative space around it, never stretched. Photography (artist, food) gets warm-contrast treatment: vignette, grain, no flat product-shot lighting.

STORY: Visitor lands from Instagram already curious → sees who's playing and when in the first breath (poster logic, not paragraph) → gets one vivid sentence of the night's promise → is shown the concrete facts (quem/quando/onde) in an editorial layout, not a spec table → is sold the sensory experience and the food → is asked, repeatedly and without friction, to reserve a table, with a sticky mobile CTA bar so the ask is never more than a thumb away.

FIRST VIEWPORT: Full-bleed dark ground with badge logo top-center (small, quiet), then a large serif event/artist name dominating, a short poster-style tagline beneath, date+time+attraction as a tight condensed info line (not cards), primary CTA "Reservar minha mesa" (solid amber fill, dark text) and secondary "Ver o evento" (outline/ghost) side by side or stacked on mobile. Portrait-oriented artist photo placeholder sits behind/beside the type as the dominant visual mass (asymmetric, bleeding off one edge), not a bounded hero image in a box.

FORM: Brief-pinned direction — user supplied exact palette, type pairing, section list (hero, event facts, experience, food showcase, reservation, sticky mobile bar, social proof if real testimonials exist, location, footer), animation register (fade/slide-up, no parallax/neon/particles), and explicit anti-references. Concept-seed roll skipped per new-work.md's rule that a user- or brief-pinned direction beats the roll; this contract records that pinned direction rather than dealing alternates. Code-led build (no confirmed image-generation tool in this environment); ambition carried in this FIRST VIEWPORT block and the signature interaction below.

Signature interaction/motion: sections fade + slide-up on scroll entrance (one grammar, staggered children within a section, never re-triggering), CTA buttons get a subtle scale+glow on hover/tap, the mobile sticky reservation bar slides in after the hero leaves view. All motion respects prefers-reduced-motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
