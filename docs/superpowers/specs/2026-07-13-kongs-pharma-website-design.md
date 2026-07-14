# Kong's Pharmaceutical Co. — Website Design Spec

**Date:** 2026-07-13
**Status:** Approved (design)
**Location:** `/Users/richardpark/Desktop/kong_pharma/code/web2`

## Summary

A new single-page marketing website for **Kong's Pharmaceutical Co.**, an
endocrine and oncology drug-discovery startup. Content is drawn verbatim from
the live site (`kongspharmaceuticals.com`); the visual language is adapted from
`hematogenix.com` — a bold, immersive, editorial biotech aesthetic built around
one dominant brand color, big rounded display type, numbered index lists, and
smooth scroll-driven animation.

## Goals

- A polished, credible startup site that reads as "well-funded biotech."
- Faithfully present Kong's real content: mission, focus areas, drug pipeline,
  and contact details.
- Self-contained and durable — no build step, hostable anywhere.

## Non-Goals

- No CMS, backend, or contact-form submission (contact is display-only:
  phone / email / address).
- No multi-page routing — single scrolling page.
- No team section (explicitly removed) and no invented people or claims.

## Tech Stack

- **Static HTML / CSS / JS.** No build step.
- **GSAP (GreenSock) + ScrollTrigger + SplitText** loaded via CDN `<script>`
  tags, pinned to a specific version (GSAP ≥ 3.13, where SplitText is free),
  for all animation.
- Google Fonts for display + body type (with system-font fallbacks).
- Files:
  - `index.html`
  - `styles.css`
  - `main.js`
  - `assets/` — real Kong's logo pulled from the live site, plus favicon.

## Visual System (Hematogenix-inspired)

- **Brand color:** deep teal. Used full-bleed for the hero and alternating
  feature sections, alternating with near-black and off-white / paper sections.
- **Typography:** large rounded geometric-sans display for headings
  (e.g. Space Grotesk / Poppins); clean sans for body; mono for the `01 / 02`
  index numerals.
- **Layout:** full-bleed color-block sections, generous whitespace, editorial
  big type, left-aligned numbered index lists.
- **Motion (GSAP):**
  - Intro splash: timeline — logo reveals on teal, then the hero headline
    animates in via SplitText.
  - **Text animation (SplitText):** headings and key statements are split into
    chars / words / lines and revealed with a staggered entrance — the hero
    headline animates per-character on load; section headings and the mission
    statement reveal per-line/word on scroll (masked line reveals via
    SplitText's `lines` with `overflow: hidden` wrappers). Splits are recomputed
    on resize/font-load, then reverted to preserve clean, selectable, accessible
    text in the DOM.
  - Scroll reveals: ScrollTrigger fades/slides each section in on enter;
    staggered entrance for numbered focus/pipeline lists and pipeline status
    tags.
  - Subtle parallax / color-block reveals between sections.
  - **Accessibility:** all animation (including SplitText reveals) gated behind
    `prefers-reduced-motion`; reduced motion skips the split and renders text
    static, fully visible, and selectable.

## Page Structure (single page, top → bottom)

1. **Intro / Hero** — full-bleed teal. Kong's logo + wordmark, large headline
   "Endocrine & Oncology Drug Innovation," one-line mission, a "Contact" CTA,
   scroll cue.
2. **Mission** — dark section, one big editorial statement: developing
   small-molecule endocrine & oncology medicines; transforming cancer into a
   manageable, chronic condition through less-toxic approaches.
3. **Focus Areas** — numbered index list:
   - `01 Endocrine` — aging population; sexual-health support for men & women.
   - `02 Oncology` — suppress cancer-cell nutrient uptake; effective and
     accessible worldwide.
4. **Pipeline** — content centerpiece, numbered editorial list; each row shows
   name, indication, and stage as a status tag:
   - `01 CR-067` — erectile dysfunction — Phase 1 clinical trials, 2025.
   - `02 K-119` — small-molecule oral bladder-cancer therapy — IND H2 2025.
   - `03 Estrogen Prodrug` — in development.
   - `04 XTL-152` — targeted oncology treatment — in development.
5. **Contact** — CTA block with verbatim details:
   - Phone: (603)-716-6789
   - Email: yanpingk@kongspharmaceutical.com
   - Address: 110 Canal Street, 4th Floor, Lowell, MA 01852
6. **Footer** — logomark, in-page nav, copyright.

**Navigation:** sticky/minimal top bar — Home · Mission · Focus · Pipeline ·
Contact, plus the logomark; links smooth-scroll to sections.

## Content Source & Accuracy

All pipeline stages, mission language, and contact details are verbatim from
`kongspharmaceuticals.com`. Where the source is thin, content is omitted rather
than invented. The logo is the real `kong_s_Logo` asset pulled from the live
site's Wix CDN at a crisp resolution.

## Component Boundaries

- **Nav** — sticky header; owns smooth-scroll + active-section highlight.
- **Section blocks** — each a self-contained `<section>` with its own color
  theme class; independently styleable and animatable.
- **Numbered index list** — one reusable pattern used by both Focus Areas and
  Pipeline.
- **Animation controller (`main.js`)** — one place that registers GSAP /
  ScrollTrigger / SplitText, waits for fonts to load before splitting, honors
  reduced-motion, and recomputes/reverts splits on resize; sections declare
  intent via data attributes / classes rather than bespoke per-section JS.

## Responsive Behavior

- Mobile-first; single-column stacking on small screens.
- Fluid type scaling for the display headings.
- Nav collapses to a compact/menu treatment on narrow viewports.

## Open Questions

None outstanding — design approved.
