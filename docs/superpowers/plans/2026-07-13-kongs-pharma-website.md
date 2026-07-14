# Kong's Pharmaceutical Co. Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained, single-page marketing website for Kong's Pharmaceutical Co. with a bold deep-teal editorial aesthetic and GSAP-driven text/scroll animation.

**Architecture:** Three static files (`index.html`, `styles.css`, `main.js`) plus an `assets/` folder, served with no build step. Markup is semantic full-bleed `<section>` blocks that alternate color themes. All motion lives in one animation controller (`main.js`) using GSAP + ScrollTrigger + SplitText from a CDN, gated behind `prefers-reduced-motion`.

**Tech Stack:** HTML5, CSS3 (custom properties, grid/flex), vanilla JS, GSAP 3.13.0 (+ ScrollTrigger, SplitText) via jsDelivr CDN, Google Fonts (Space Grotesk / Inter / JetBrains Mono).

## Global Constraints

- Root directory for all site files: `/Users/richardpark/Desktop/kong_pharma/code/web2`.
- No build step; site must open directly from `file://` and work when served statically.
- GSAP version pinned to **3.13.0** (SplitText is free from ≥ 3.13). Load from `https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/{gsap,ScrollTrigger,SplitText}.min.js`.
- All animation MUST be gated behind `prefers-reduced-motion: reduce`; reduced motion renders all text/sections static, fully visible, and selectable.
- Brand color: **deep teal**. Sections alternate teal / near-black (ink) / off-white (paper).
- Content is **verbatim** from `kongspharmaceuticals.com`. No invented people, drugs, claims, or stats. No team section.
- Contact is display-only (no form submission): phone `(603)-716-6789`, email `yanpingk@kongspharmaceutical.com`, address `110 Canal Street, 4th Floor, Lowell, MA 01852`.
- Pipeline (verbatim): `CR-067` erectile dysfunction, Phase 1 clinical trials 2025 · `K-119` small-molecule oral bladder-cancer therapy, IND H2 2025 · `Estrogen Prodrug` in development · `XTL-152` targeted oncology treatment, in development.
- Design tokens (use these exact values):
  - `--teal: #0B5563` · `--teal-deep: #083E48` · `--teal-bright: #2FB7A6`
  - `--ink: #0F1416` · `--paper: #F4F1E9` · `--paper-dim: #DED9CC`
  - `--on-teal: #F4F1E9` · `--on-ink: #F4F1E9` · `--on-paper: #0F1416`
  - Fonts: display `'Space Grotesk'`, body `'Inter'`, mono `'JetBrains Mono'`.

---

### Task 1: Project scaffold, assets, and CDN wiring

**Files:**
- Create: `web2/index.html`
- Create: `web2/styles.css`
- Create: `web2/main.js`
- Create: `web2/assets/kongs-logo.png` (downloaded)
- Create: `web2/assets/favicon.ico` (downloaded)

**Interfaces:**
- Produces: the HTML skeleton with `<head>` (fonts + GSAP CDN scripts), an empty `<body>` shell containing `<header class="nav">`, `<main>`, `<footer>`; `styles.css` with the `:root` token block; `main.js` with a no-op DOMContentLoaded guard. Later tasks fill `<main>` and the controller.

- [ ] **Step 1: Create the directory and download real brand assets**

```bash
cd /Users/richardpark/Desktop/kong_pharma/code/web2
mkdir -p assets
# Real Kong's logo (transparent PNG) from the live site's Wix CDN, full resolution:
curl -sL "https://static.wixstatic.com/media/228c6e_b014f30d68254ef2a7e7efadaad32138~mv2.png" -o assets/kongs-logo.png
# Favicon from the live site:
curl -sL "https://static.wixstatic.com/media/228c6e_144b6a69d6474d3eae533d3d33d9ecb2~mv2.png/v1/fill/w_192,h_192,lg_1,usm_0.66_1.00_0.01/228c6e_144b6a69d6474d3eae533d3d33d9ecb2~mv2.png" -o assets/favicon.png
```

- [ ] **Step 2: Verify the assets downloaded and are valid images**

Run: `cd /Users/richardpark/Desktop/kong_pharma/code/web2 && file assets/kongs-logo.png assets/favicon.png && ls -la assets`
Expected: both report `PNG image data` with non-zero size (logo > 3 KB). If the logo is a 0-byte/HTML error, fall back to `curl -sL "https://static.wixstatic.com/media/228c6e_b014f30d68254ef2a7e7efadaad32138~mv2.png/v1/fill/w_500,h_470,al_c/kong_s_Logo.png" -o assets/kongs-logo.png` and re-check.

- [ ] **Step 3: Write `index.html` skeleton**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kong's Pharmaceutical Co. — Endocrine & Oncology Drug Innovation</title>
    <meta
      name="description"
      content="Kong's Pharmaceutical Co. develops cutting-edge small-molecule endocrine and oncology medicines to aid patient recovery."
    />
    <link rel="icon" href="assets/favicon.png" type="image/png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="nav" data-nav>
      <!-- Task 3 -->
    </header>
    <main>
      <!-- Tasks 4–8 -->
    </main>
    <footer class="site-footer">
      <!-- Task 8 -->
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js"></script>
    <script src="main.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Write the `styles.css` token block**

```css
/* ===== Design tokens ===== */
:root {
  --teal: #0b5563;
  --teal-deep: #083e48;
  --teal-bright: #2fb7a6;
  --ink: #0f1416;
  --paper: #f4f1e9;
  --paper-dim: #ded9cc;
  --on-teal: #f4f1e9;
  --on-ink: #f4f1e9;
  --on-paper: #0f1416;

  --font-display: "Space Grotesk", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --maxw: 1200px;
  --pad-x: clamp(1.25rem, 5vw, 5rem);
  --section-y: clamp(4rem, 12vh, 9rem);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: var(--font-body);
  color: var(--on-paper);
  background: var(--paper);
  -webkit-font-smoothing: antialiased;
  line-height: 1.5;
}

img {
  max-width: 100%;
  display: block;
}

a {
  color: inherit;
  text-decoration: none;
}
```

- [ ] **Step 5: Write the `main.js` guard**

```js
document.addEventListener("DOMContentLoaded", () => {
  // Animation controller is wired up in Task 9.
  console.log("Kong's Pharma site loaded");
});
```

- [ ] **Step 6: Verify the skeleton renders in the browser**

Open the file in the in-app browser (preview_start with `url: "file:///Users/richardpark/Desktop/kong_pharma/code/web2/index.html"`), then screenshot.
Expected: blank paper-colored page, no console errors except the log line; Network panel shows the three GSAP scripts and the font stylesheet returning 200.

- [ ] **Step 7: Commit** (only if `web2` is a git repo — see note at end of plan)

```bash
cd /Users/richardpark/Desktop/kong_pharma/code/web2
git add index.html styles.css main.js assets
git commit -m "feat: scaffold Kong's Pharma site with assets and GSAP CDN"
```

---

### Task 2: Layout primitives and section theming

**Files:**
- Modify: `web2/styles.css` (append)

**Interfaces:**
- Produces CSS utility classes consumed by all section tasks: `.section`, `.section--teal`, `.section--ink`, `.section--paper`, `.container`, `.eyebrow`, `.display`, `.reveal-line` (masked-line wrapper), and the reduced-motion fallback rule. Section blocks add a theme modifier class; the numbered-list tasks rely on `.container` for width.

- [ ] **Step 1: Append layout + theme CSS**

```css
/* ===== Layout primitives ===== */
.container {
  width: 100%;
  max-width: var(--maxw);
  margin-inline: auto;
  padding-inline: var(--pad-x);
}

.section {
  padding-block: var(--section-y);
}

.section--teal {
  background: var(--teal);
  color: var(--on-teal);
}
.section--ink {
  background: var(--ink);
  color: var(--on-ink);
}
.section--paper {
  background: var(--paper);
  color: var(--on-paper);
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.75;
  margin: 0 0 1.5rem;
}

.display {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -0.02em;
  font-size: clamp(2.4rem, 7vw, 5.5rem);
  margin: 0;
}

.lead {
  font-size: clamp(1.1rem, 2vw, 1.5rem);
  max-width: 46ch;
}

/* Masked line-reveal wrapper for SplitText (lines get wrapped in this) */
.reveal-line {
  overflow: hidden;
}

/* ===== Reduced motion: everything visible, no transforms ===== */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  .anim-hidden {
    opacity: 1 !important;
    transform: none !important;
  }
}
```

- [ ] **Step 2: Verify by temporarily theming the body**

Add `class="section section--teal"` to `<main>` temporarily, refresh the browser, screenshot.
Expected: `<main>` area renders full deep-teal. Then remove the temporary class.

- [ ] **Step 3: Commit**

```bash
git add styles.css && git commit -m "feat: add layout primitives and section theming"
```

---

### Task 3: Sticky navigation with smooth-scroll anchors

**Files:**
- Modify: `web2/index.html` (`<header class="nav">`)
- Modify: `web2/styles.css` (append)

**Interfaces:**
- Consumes: `.container` from Task 2.
- Produces: nav markup with anchor links to `#hero`, `#mission`, `#focus`, `#pipeline`, `#contact` (section ids created in Tasks 4–8) and `data-nav-link` attributes consumed by the active-section highlighter in Task 11.

- [ ] **Step 1: Fill the header markup**

```html
<header class="nav" data-nav>
  <div class="nav__inner container">
    <a class="nav__brand" href="#hero" aria-label="Kong's Pharmaceutical Co. — home">
      <img src="assets/kongs-logo.png" alt="Kong's Pharmaceutical Co." class="nav__logo" />
    </a>
    <nav class="nav__links" aria-label="Primary">
      <a href="#mission" data-nav-link>Mission</a>
      <a href="#focus" data-nav-link>Focus</a>
      <a href="#pipeline" data-nav-link>Pipeline</a>
      <a href="#contact" data-nav-link class="nav__cta">Contact</a>
    </nav>
  </div>
</header>
```

- [ ] **Step 2: Append nav CSS**

```css
/* ===== Nav ===== */
.nav {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 50;
  background: color-mix(in srgb, var(--teal-deep) 82%, transparent);
  backdrop-filter: blur(10px);
  transition: background 0.3s ease;
}
.nav__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 68px;
}
.nav__logo {
  height: 34px;
  width: auto;
}
.nav__links {
  display: flex;
  gap: clamp(1rem, 3vw, 2.5rem);
  align-items: center;
  font-size: 0.95rem;
  color: var(--on-teal);
}
.nav__links a {
  opacity: 0.85;
  transition: opacity 0.2s ease;
}
.nav__links a:hover,
.nav__links a[aria-current="true"] {
  opacity: 1;
}
.nav__cta {
  border: 1px solid color-mix(in srgb, var(--on-teal) 45%, transparent);
  border-radius: 999px;
  padding: 0.45rem 1.1rem;
}
@media (max-width: 560px) {
  .nav__links a:not(.nav__cta) {
    display: none;
  }
}
```

- [ ] **Step 3: Verify nav renders and is fixed**

Refresh browser, screenshot. Expected: translucent dark-teal bar pinned to top with the real Kong's logo at left and Mission/Focus/Pipeline links + a pill-shaped Contact at right. (Anchor clicks will land once sections exist.)

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css && git commit -m "feat: add sticky navigation with smooth-scroll anchors"
```

---

### Task 4: Hero / intro section

**Files:**
- Modify: `web2/index.html` (`<main>`)
- Modify: `web2/styles.css` (append)

**Interfaces:**
- Consumes: `.section--teal`, `.container`, `.display` from Task 2.
- Produces: `<section id="hero">` containing `.hero__headline` (the SplitText target for Task 10), a `.hero__mission` lead line, a contact CTA, and a `.hero__scrollcue`. Task 10 animates `[data-split="chars"]`; Task 11 uses `#hero` as a scroll anchor.

- [ ] **Step 1: Add the hero markup inside `<main>`**

```html
<section id="hero" class="section section--teal hero">
  <div class="container hero__inner">
    <p class="eyebrow">Kong's Pharmaceutical Co.</p>
    <h1 class="display hero__headline" data-split="chars">
      Endocrine &amp; Oncology Drug Innovation
    </h1>
    <p class="lead hero__mission">
      Developing cutting-edge small-molecule medicines to aid patient recovery.
    </p>
    <a href="#contact" class="btn btn--light">Get in touch</a>
    <div class="hero__scrollcue" aria-hidden="true">Scroll</div>
  </div>
</section>
```

- [ ] **Step 2: Append hero + button CSS**

```css
/* ===== Buttons ===== */
.btn {
  display: inline-block;
  font-family: var(--font-display);
  font-weight: 500;
  border-radius: 999px;
  padding: 0.8rem 1.8rem;
  transition: transform 0.2s ease, background 0.2s ease;
}
.btn:hover {
  transform: translateY(-2px);
}
.btn--light {
  background: var(--on-teal);
  color: var(--teal-deep);
}

/* ===== Hero ===== */
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
}
.hero__inner {
  padding-top: 68px;
}
.hero__headline {
  margin: 0.5rem 0 1.5rem;
  max-width: 16ch;
}
.hero__mission {
  margin-bottom: 2.25rem;
}
.hero__scrollcue {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.7;
  margin-top: 3.5rem;
}
```

- [ ] **Step 3: Verify hero fills the viewport**

Refresh browser, screenshot. Expected: full-screen deep-teal hero, large off-white headline "Endocrine & Oncology Drug Innovation," mission line, a light pill CTA, and a "Scroll" cue. Clicking the nav "Contact" does nothing yet (target added Task 8) — that's fine.

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css && git commit -m "feat: add hero/intro section"
```

---

### Task 5: Mission section

**Files:**
- Modify: `web2/index.html` (`<main>`)
- Modify: `web2/styles.css` (append)

**Interfaces:**
- Consumes: `.section--ink`, `.container`, `.eyebrow` from Task 2.
- Produces: `<section id="mission">` with a `.mission__statement` element carrying `data-split="lines"` (SplitText line target for Task 11).

- [ ] **Step 1: Add mission markup after the hero section**

```html
<section id="mission" class="section section--ink mission">
  <div class="container">
    <p class="eyebrow">Our Mission</p>
    <p class="display mission__statement" data-split="lines">
      We develop endocrine and oncology therapies from small-molecule compounds —
      working to transform cancer into a manageable, chronic condition through
      effective, less-toxic, and accessible treatments.
    </p>
  </div>
</section>
```

- [ ] **Step 2: Append mission CSS**

```css
/* ===== Mission ===== */
.mission__statement {
  font-size: clamp(1.6rem, 4vw, 3rem);
  font-weight: 500;
  line-height: 1.2;
  max-width: 22ch;
}
.mission__statement {
  max-width: 30ch;
}
```

- [ ] **Step 3: Verify**

Refresh browser, scroll to the mission section, screenshot. Expected: near-black section with the mission statement in large off-white display type.

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css && git commit -m "feat: add mission section"
```

---

### Task 6: Focus Areas numbered index list

**Files:**
- Modify: `web2/index.html` (`<main>`)
- Modify: `web2/styles.css` (append)

**Interfaces:**
- Consumes: `.section--paper`, `.container`, `.eyebrow` from Task 2.
- Produces: `<section id="focus">` with a `.index-list` containing `.index-item` rows. This `.index-list` / `.index-item` / `.index-num` pattern is REUSED verbatim by Task 7 (pipeline). Task 11 staggers `.index-item` on scroll.

- [ ] **Step 1: Add focus markup after the mission section**

```html
<section id="focus" class="section section--paper focus">
  <div class="container">
    <p class="eyebrow">Focus Areas</p>
    <ol class="index-list">
      <li class="index-item">
        <span class="index-num">01</span>
        <div class="index-body">
          <h3 class="index-title">Endocrine</h3>
          <p class="index-desc">
            Supporting an aging population — including sexual-health therapies for
            men and women — by optimizing the endocrine system.
          </p>
        </div>
      </li>
      <li class="index-item">
        <span class="index-num">02</span>
        <div class="index-body">
          <h3 class="index-title">Oncology</h3>
          <p class="index-desc">
            Developing therapies that suppress cancer-cell nutrient uptake —
            effective, less toxic, and accessible worldwide.
          </p>
        </div>
      </li>
    </ol>
  </div>
</section>
```

- [ ] **Step 2: Append the reusable index-list CSS**

```css
/* ===== Numbered index list (shared: Focus + Pipeline) ===== */
.index-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid color-mix(in srgb, currentColor 22%, transparent);
}
.index-item {
  display: grid;
  grid-template-columns: 4rem 1fr;
  gap: clamp(1rem, 4vw, 3rem);
  align-items: start;
  padding-block: clamp(1.75rem, 4vw, 2.75rem);
  border-bottom: 1px solid color-mix(in srgb, currentColor 22%, transparent);
}
.index-num {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  opacity: 0.6;
  padding-top: 0.4rem;
}
.index-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.6rem, 3.5vw, 2.75rem);
  margin: 0 0 0.5rem;
  letter-spacing: -0.01em;
}
.index-desc {
  margin: 0;
  max-width: 52ch;
  opacity: 0.85;
}
```

- [ ] **Step 3: Verify**

Refresh browser, scroll to focus, screenshot. Expected: paper section, two rows with mono `01`/`02` at left and Endocrine/Oncology titles + descriptions at right, hairline dividers between rows.

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css && git commit -m "feat: add Focus Areas numbered index list"
```

---

### Task 7: Pipeline section with status tags

**Files:**
- Modify: `web2/index.html` (`<main>`)
- Modify: `web2/styles.css` (append)

**Interfaces:**
- Consumes: `.section--teal`, `.container`, `.eyebrow`, and the `.index-list` / `.index-item` / `.index-num` / `.index-title` / `.index-desc` pattern from Task 6.
- Produces: `<section id="pipeline">` reusing the index list, each item adding a `.status-tag`. Task 11 staggers these `.index-item`s and their `.status-tag`s.

- [ ] **Step 1: Add pipeline markup after the focus section**

```html
<section id="pipeline" class="section section--teal pipeline">
  <div class="container">
    <p class="eyebrow">Pipeline</p>
    <ol class="index-list">
      <li class="index-item">
        <span class="index-num">01</span>
        <div class="index-body">
          <h3 class="index-title">CR-067</h3>
          <p class="index-desc">Erectile dysfunction treatment.</p>
          <span class="status-tag">Phase 1 · 2025</span>
        </div>
      </li>
      <li class="index-item">
        <span class="index-num">02</span>
        <div class="index-body">
          <h3 class="index-title">K-119</h3>
          <p class="index-desc">Small-molecule oral bladder-cancer therapy.</p>
          <span class="status-tag">IND · H2 2025</span>
        </div>
      </li>
      <li class="index-item">
        <span class="index-num">03</span>
        <div class="index-body">
          <h3 class="index-title">Estrogen Prodrug</h3>
          <p class="index-desc">Endocrine program.</p>
          <span class="status-tag">In development</span>
        </div>
      </li>
      <li class="index-item">
        <span class="index-num">04</span>
        <div class="index-body">
          <h3 class="index-title">XTL-152</h3>
          <p class="index-desc">Targeted oncology treatment.</p>
          <span class="status-tag">In development</span>
        </div>
      </li>
    </ol>
  </div>
</section>
```

- [ ] **Step 2: Append status-tag CSS**

```css
/* ===== Pipeline status tag ===== */
.status-tag {
  display: inline-block;
  margin-top: 1rem;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  padding: 0.35rem 0.8rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--teal-bright) 22%, transparent);
  border: 1px solid color-mix(in srgb, var(--teal-bright) 55%, transparent);
  color: var(--on-teal);
}
```

- [ ] **Step 3: Verify**

Refresh browser, scroll to pipeline, screenshot. Expected: deep-teal section, four numbered rows (CR-067, K-119, Estrogen Prodrug, XTL-152), each with a rounded status pill.

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css && git commit -m "feat: add pipeline section with status tags"
```

---

### Task 8: Contact section and footer

**Files:**
- Modify: `web2/index.html` (`<main>` end + `<footer>`)
- Modify: `web2/styles.css` (append)

**Interfaces:**
- Consumes: `.section--paper`, `.container`, `.eyebrow`, `.display`, `.btn` from earlier tasks.
- Produces: `<section id="contact">` (the target the hero/nav CTAs link to) and the populated `.site-footer`. Completes all nav anchor targets, so Task 11's active-section highlighting can cover the full page.

- [ ] **Step 1: Add contact markup at the end of `<main>`**

```html
<section id="contact" class="section section--paper contact">
  <div class="container">
    <p class="eyebrow">Contact</p>
    <h2 class="display contact__title">Advancing patient recovery, together.</h2>
    <ul class="contact__list">
      <li>
        <span class="contact__label">Phone</span>
        <a href="tel:+16037166789">(603)-716-6789</a>
      </li>
      <li>
        <span class="contact__label">Email</span>
        <a href="mailto:yanpingk@kongspharmaceutical.com">yanpingk@kongspharmaceutical.com</a>
      </li>
      <li>
        <span class="contact__label">Address</span>
        <span>110 Canal Street, 4th Floor, Lowell, MA 01852</span>
      </li>
    </ul>
  </div>
</section>
```

- [ ] **Step 2: Fill the footer markup**

```html
<footer class="site-footer">
  <div class="container site-footer__inner">
    <a class="site-footer__brand" href="#hero">
      <img src="assets/kongs-mark.png" alt="" class="site-footer__mark" />
      <span class="site-footer__wordmark">Kong's Pharmaceutical</span>
    </a>
    <nav class="site-footer__links" aria-label="Footer">
      <a href="#mission">Mission</a>
      <a href="#focus">Focus</a>
      <a href="#pipeline">Pipeline</a>
      <a href="#contact">Contact</a>
    </nav>
    <p class="site-footer__copy">© 2026 Kong's Pharmaceutical Co. All rights reserved.</p>
  </div>
</footer>
```

- [ ] **Step 3: Append contact + footer CSS**

```css
/* ===== Contact ===== */
.contact__title {
  font-size: clamp(2rem, 5vw, 3.5rem);
  max-width: 16ch;
  margin: 0 0 2.5rem;
}
.contact__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1.25rem;
  font-size: 1.1rem;
}
.contact__list li {
  display: grid;
  grid-template-columns: 6rem 1fr;
  gap: 1.5rem;
  padding-block: 1rem;
  border-top: 1px solid var(--paper-dim);
}
.contact__label {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.6;
  padding-top: 0.15rem;
}
.contact__list a:hover {
  color: var(--teal);
}

/* ===== Footer ===== */
.site-footer {
  background: var(--ink);
  color: var(--on-ink);
  padding-block: 3rem;
}
.site-footer__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.5rem 2.5rem;
  justify-content: space-between;
}
.site-footer__brand {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.site-footer__mark {
  height: 30px;
  width: auto;
}
.site-footer__wordmark {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
}
.site-footer__links {
  display: flex;
  gap: 1.5rem;
  opacity: 0.85;
  font-size: 0.95rem;
}
.site-footer__copy {
  width: 100%;
  margin: 0;
  opacity: 0.55;
  font-size: 0.85rem;
}
```

- [ ] **Step 4: Verify full-page flow and working anchors**

Refresh browser. Click nav "Contact" → page scrolls to the contact section. Screenshot the contact section and footer. Expected: paper contact block with phone/email/address rows (tel: and mailto: links) and a dark footer with logo, links, and copyright.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css && git commit -m "feat: add contact section and footer"
```

---

### Task 9: Animation controller foundation (GSAP register + reduced-motion + font-ready split helper)

**Files:**
- Modify: `web2/main.js` (replace guard)

**Interfaces:**
- Consumes: global `gsap`, `ScrollTrigger`, `SplitText` from the CDN scripts; DOM elements from Tasks 4–8.
- Produces: a module that registers plugins, exposes a `prefersReducedMotion` boolean, and defines `splitReady(callback)` which waits for fonts before running animation setup. Tasks 10–11 add their timelines inside the `initAnimations()` body created here.

- [ ] **Step 1: Replace `main.js` with the controller foundation**

```js
document.addEventListener("DOMContentLoaded", () => {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // With reduced motion (or no GSAP), leave the DOM fully visible and do nothing.
  if (prefersReducedMotion || !window.gsap) {
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText);

  // Wait for web fonts so SplitText measures final glyph widths.
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => {
    initAnimations();
    ScrollTrigger.refresh();
  });

  function initAnimations() {
    // Task 10 (intro/hero) and Task 11 (scroll reveals) add their code here.
  }
});
```

- [ ] **Step 2: Verify no regression**

Refresh browser, screenshot, check console. Expected: page looks identical to Task 8, no console errors. Then open the browser's emulated reduced-motion (or set OS reduced motion) and confirm the page still renders fully — controller early-returns.

- [ ] **Step 3: Commit**

```bash
git add main.js && git commit -m "feat: add GSAP animation controller foundation"
```

---

### Task 10: Intro splash + hero headline SplitText animation

**Files:**
- Modify: `web2/main.js` (inside `initAnimations`)
- Modify: `web2/styles.css` (append the hidden-until-animated helper)

**Interfaces:**
- Consumes: `initAnimations()` from Task 9; the `#hero`, `.hero__headline[data-split="chars"]`, `.eyebrow`, `.hero__mission`, `.btn`, `.hero__scrollcue` elements from Task 4.
- Produces: an intro timeline. Establishes the `.anim-hidden` pattern (opacity 0 pre-animation, forced visible under reduced motion — rule already present from Task 2) used by Task 11.

- [ ] **Step 1: Append the pre-animation hidden helper to `styles.css`**

```css
/* Elements animated in by GSAP start hidden (JS-enabled, motion-OK only). */
.js-anim .anim-hidden {
  opacity: 0;
}
```

- [ ] **Step 2: Add a `js-anim` class gate at the top of `initAnimations` and build the hero timeline**

Replace the `initAnimations` body in `main.js` with:

```js
function initAnimations() {
  document.documentElement.classList.add("js-anim");

  // ---- Intro / hero ----
  const headline = document.querySelector('.hero__headline[data-split="chars"]');
  const heroBits = gsap.utils.toArray([
    "#hero .eyebrow",
    "#hero .hero__mission",
    "#hero .btn",
    "#hero .hero__scrollcue",
  ]);
  heroBits.forEach((el) => el.classList.add("anim-hidden"));

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  if (headline) {
    const split = new SplitText(headline, { type: "chars", charsClass: "split-char" });
    gsap.set(headline, { autoAlpha: 1 });
    tl.from(split.chars, {
      yPercent: 120,
      opacity: 0,
      duration: 0.7,
      stagger: 0.02,
    });
  }

  tl.to(
    heroBits,
    { opacity: 1, y: 0, duration: 0.6, stagger: 0.12 },
    "-=0.3"
  ).from(
    heroBits,
    { y: 20, duration: 0.6, stagger: 0.12 },
    "<"
  );
}
```

- [ ] **Step 3: Add the char-clip style so characters rise behind a mask**

Append to `styles.css`:

```css
.hero__headline .split-char {
  display: inline-block;
  will-change: transform;
}
.hero__headline {
  overflow: hidden;
}
```

- [ ] **Step 4: Verify the intro animates**

Refresh browser. Expected: on load the headline characters rise/stagger into place, then the eyebrow, mission line, CTA, and scroll cue fade up. Screenshot mid-and-post animation. Confirm the final state matches Task 4's static layout (nothing left invisible).

- [ ] **Step 5: Verify reduced motion still shows everything**

Toggle reduced motion on, refresh. Expected: headline and hero bits fully visible immediately (no `js-anim`, controller early-returns). Screenshot.

- [ ] **Step 6: Commit**

```bash
git add main.js styles.css && git commit -m "feat: add intro splash and hero SplitText animation"
```

---

### Task 11: Scroll-triggered reveals (mission lines, index-item stagger, active nav)

**Files:**
- Modify: `web2/main.js` (inside `initAnimations`, after the hero timeline)

**Interfaces:**
- Consumes: `initAnimations()` and the `js-anim`/`anim-hidden` pattern; `.mission__statement[data-split="lines"]`, `.index-item`, `.status-tag`, `#hero/#mission/#focus/#pipeline/#contact` sections, and `[data-nav-link]` from earlier tasks.
- Produces: ScrollTrigger-driven reveals and active-nav highlighting. Final animation behavior of the site.

- [ ] **Step 1: Append scroll-reveal code to the end of `initAnimations`**

```js
  // ---- Mission: masked line reveal ----
  const mission = document.querySelector('.mission__statement[data-split="lines"]');
  if (mission) {
    const mSplit = new SplitText(mission, {
      type: "lines",
      linesClass: "reveal-line-inner",
    });
    // Wrap each line so it can be clipped.
    mSplit.lines.forEach((line) => {
      const wrap = document.createElement("span");
      wrap.className = "reveal-line";
      line.parentNode.insertBefore(wrap, line);
      wrap.appendChild(line);
    });
    gsap.set(mission, { autoAlpha: 1 });
    gsap.from(mSplit.lines, {
      yPercent: 110,
      duration: 0.8,
      ease: "power3.out",
      stagger: 0.12,
      scrollTrigger: { trigger: mission, start: "top 80%" },
    });
  }

  // ---- Numbered index items (Focus + Pipeline) ----
  gsap.utils.toArray(".index-item").forEach((item) => {
    item.classList.add("anim-hidden");
    gsap.to(item, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: "power3.out",
      scrollTrigger: { trigger: item, start: "top 85%" },
    });
    gsap.from(item, {
      y: 40,
      duration: 0.7,
      ease: "power3.out",
      scrollTrigger: { trigger: item, start: "top 85%" },
    });
  });

  // ---- Status tags pop in ----
  gsap.utils.toArray(".status-tag").forEach((tag) => {
    gsap.from(tag, {
      scale: 0.85,
      opacity: 0,
      duration: 0.4,
      ease: "back.out(1.7)",
      scrollTrigger: { trigger: tag, start: "top 90%" },
    });
  });

  // ---- Active nav link highlighting ----
  const navLinks = gsap.utils.toArray("[data-nav-link]");
  navLinks.forEach((link) => {
    const id = link.getAttribute("href");
    const section = document.querySelector(id);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: "top center",
      end: "bottom center",
      onToggle: (self) =>
        link.setAttribute("aria-current", self.isActive ? "true" : "false"),
    });
  });
```

- [ ] **Step 2: Add the reveal-line-inner style**

Append to `styles.css`:

```css
.reveal-line-inner {
  display: block;
  will-change: transform;
}
```

- [ ] **Step 3: Verify scroll reveals**

Refresh browser. Slowly scroll from top to bottom, screenshotting at mission, focus, and pipeline. Expected: mission lines rise behind masks as the section enters; index items fade/slide up in sequence; status pills pop; the active nav link changes `aria-current` as sections pass center (visible as the hover-opacity/active style). Confirm nothing stays stuck invisible after passing.

- [ ] **Step 4: Verify reduced motion**

Toggle reduced motion on, refresh, scroll. Expected: all sections/items fully visible and static; no reveal animations. Screenshot mission + pipeline.

- [ ] **Step 5: Commit**

```bash
git add main.js styles.css && git commit -m "feat: add scroll-triggered reveals and active nav"
```

---

### Task 12: Responsive polish, cross-check, and final verification

**Files:**
- Modify: `web2/styles.css` (append responsive tweaks)

**Interfaces:**
- Consumes: everything. No new interfaces produced — this is the finishing pass.

- [ ] **Step 1: Append responsive refinements**

```css
/* ===== Responsive polish ===== */
@media (max-width: 640px) {
  .index-item {
    grid-template-columns: 2.5rem 1fr;
    gap: 1rem;
  }
  .contact__list li {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
  .hero {
    min-height: 92vh;
  }
}
```

- [ ] **Step 2: Verify at mobile width**

Resize the in-app browser to mobile (`375×812`), refresh, scroll the full page, screenshot hero / focus / pipeline / contact. Expected: single-column, no horizontal scroll, nav collapses to just the Contact pill, index numbers stay aligned, text remains readable.

- [ ] **Step 3: Verify at desktop width**

Resize to `1440×900`, refresh, screenshot full scroll. Expected: centered max-width content, animations smooth, all sections themed correctly.

- [ ] **Step 4: Content accuracy cross-check**

Re-read the "Content Source & Accuracy" and pipeline lines in the spec and confirm the rendered page matches verbatim (drug names, indications, phases, phone, email, address). Fix any drift.

- [ ] **Step 5: Console + network check**

Open browser console and network panel, hard refresh. Expected: zero JS errors; GSAP core, ScrollTrigger, SplitText, and fonts all load 200.

- [ ] **Step 6: Final commit**

```bash
git add styles.css && git commit -m "feat: responsive polish and final verification"
```

---

## Git note

`web2` is not currently a git repository, and per the user's environment rules git is only initialized/committed on explicit request. If the user wants version control, run `git init` in `web2` first; otherwise skip every `git commit` step above (the site is fully functional without it).

## Self-Review

- **Spec coverage:** stack/files (Task 1), tokens & theming (Tasks 1–2), nav + smooth scroll (Task 3), hero/mission/focus/pipeline/contact/footer sections (Tasks 4–8), GSAP+ScrollTrigger+SplitText load and controller (Tasks 1, 9), intro splash + hero char reveal (Task 10), masked line reveals + list stagger + status-tag pop + active nav (Task 11), reduced-motion gating (Tasks 2, 9, 10, 11), responsive (Tasks 2 fluid + 12), real logo (Task 1), verbatim content (Tasks 4–8, 12). No team section anywhere. All spec sections map to a task.
- **Placeholders:** none — every step has concrete code or an exact command + expected result.
- **Type/name consistency:** shared class names (`.section--*`, `.container`, `.eyebrow`, `.display`, `.index-list/.index-item/.index-num/.index-title/.index-desc`, `.status-tag`, `.anim-hidden`, `.js-anim`, `data-split`, `data-nav-link`) are defined once and referenced consistently; `initAnimations()` is defined in Task 9 and extended in Tasks 10–11.
