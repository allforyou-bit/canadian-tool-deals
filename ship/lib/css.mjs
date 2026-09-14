/**
 * The stylesheet, inlined into every page.
 *
 * Inlined rather than linked because these sites are one page: a separate
 * stylesheet costs a round trip and buys nothing, and inlining removes any
 * dependency on a CDN that could be blocked or slow.
 *
 * Colour is driven by two tokens the brief sets (`accent` and `accentInk`).
 * Everything else is fixed, so a brief cannot produce an unreadable page.
 */

/** Accent presets, so a brief can say "slate" instead of picking hex values. */
export const ACCENTS = {
  slate:    { light: '#334155', dark: '#94a3b8', ink: '#ffffff' },
  blue:     { light: '#1d4ed8', dark: '#93b4fd', ink: '#ffffff' },
  teal:     { light: '#0f766e', dark: '#5eead4', ink: '#ffffff' },
  green:    { light: '#15803d', dark: '#86efac', ink: '#ffffff' },
  amber:    { light: '#b45309', dark: '#fcd34d', ink: '#ffffff' },
  rust:     { light: '#b3421f', dark: '#fdba74', ink: '#ffffff' },
  crimson:  { light: '#be123c', dark: '#fda4af', ink: '#ffffff' },
  violet:   { light: '#6d28d9', dark: '#c4b5fd', ink: '#ffffff' },
}

export function resolveAccent(name) {
  return ACCENTS[name] ?? ACCENTS.slate
}

export function stylesheet(accentName) {
  const a = resolveAccent(accentName)
  return `
:root {
  color-scheme: light;
  --bg: #ffffff;
  --bg-sunk: #f6f7f9;
  --bg-raise: #ffffff;
  --ink: #16181d;
  --ink-soft: #565b66;
  --ink-faint: #8a8f9a;
  --line: #e3e5ea;
  --line-strong: #c9ccd4;
  --accent: ${a.light};
  --accent-ink: ${a.ink};
  --accent-wash: color-mix(in srgb, ${a.light} 7%, #ffffff);
  --shadow: 0 1px 2px rgb(16 24 40 / 6%), 0 8px 24px -12px rgb(16 24 40 / 14%);
  --radius: 14px;
  --radius-sm: 9px;
  --maxw: 68rem;
  --gutter: clamp(1rem, 4vw, 2.5rem);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #0e1014;
    --bg-sunk: #15181e;
    --bg-raise: #1a1e25;
    --ink: #eef0f4;
    --ink-soft: #a8aeba;
    --ink-faint: #757c89;
    --line: #262b34;
    --line-strong: #3a4150;
    --accent: ${a.dark};
    --accent-ink: #0e1014;
    --accent-wash: color-mix(in srgb, ${a.dark} 12%, #0e1014);
    --shadow: 0 1px 2px rgb(0 0 0 / 40%), 0 10px 30px -14px rgb(0 0 0 / 70%);
  }
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 400 clamp(1rem, 0.97rem + 0.15vw, 1.0625rem)/1.65 ui-sans-serif, system-ui, -apple-system,
        "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans KR", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

h1, h2, h3 { line-height: 1.18; letter-spacing: -0.018em; margin: 0 0 0.5em; font-weight: 650; text-wrap: balance; }
h1 { font-size: clamp(2rem, 1.45rem + 2.6vw, 3.35rem); }
h2 { font-size: clamp(1.5rem, 1.2rem + 1.3vw, 2.1rem); }
h3 { font-size: 1.125rem; font-weight: 640; }
p  { margin: 0 0 1em; text-wrap: pretty; }
p:last-child { margin-bottom: 0; }
a { color: var(--accent); text-underline-offset: 0.18em; }
a:hover { text-decoration-thickness: 2px; }
code {
  font: 0.9em ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  background: var(--bg-sunk); border: 1px solid var(--line);
  padding: 0.1em 0.35em; border-radius: 5px;
}
img { max-width: 100%; height: auto; display: block; }
ul, ol { margin: 0 0 1em; padding-left: 1.3em; }
li + li { margin-top: 0.35em; }
hr { border: 0; border-top: 1px solid var(--line); margin: 0; }

:where(a, button, summary, input, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

.skip {
  position: absolute; left: -9999px; top: 0;
  background: var(--accent); color: var(--accent-ink);
  padding: 0.6rem 1rem; border-radius: 0 0 var(--radius-sm) 0; z-index: 50;
}
.skip:focus { left: 0; }

.wrap { width: 100%; max-width: var(--maxw); margin-inline: auto; padding-inline: var(--gutter); }

/* ── Proposal banner ─────────────────────────────────────────────────────── */
.banner {
  background: var(--bg-sunk);
  border-bottom: 1px solid var(--line);
  color: var(--ink-soft);
  font-size: 0.84rem;
  padding-block: 0.7rem;
}
.banner strong { color: var(--ink); }
.banner p { margin: 0; }

/* ── Header ──────────────────────────────────────────────────────────────── */
.site-head { border-bottom: 1px solid var(--line); background: var(--bg); }
.site-head .row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; padding-block: 1.1rem; flex-wrap: wrap;
}
.brand { display: inline-flex; align-items: center; gap: 0.6rem; font-weight: 680; font-size: 1.05rem; color: var(--ink); text-decoration: none; }
.brand .mark {
  width: 1.85rem; height: 1.85rem; flex: 0 0 auto;
  display: grid; place-items: center;
  background: var(--accent); color: var(--accent-ink);
  border-radius: 8px; font-size: 0.9rem; font-weight: 700; letter-spacing: 0;
}
.nav { display: flex; gap: clamp(0.75rem, 2vw, 1.5rem); align-items: center; flex-wrap: wrap; }
.nav a { color: var(--ink-soft); text-decoration: none; font-size: 0.94rem; }
.nav a:hover { color: var(--ink); }

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 0.78rem 1.4rem; border-radius: var(--radius-sm);
  font-weight: 620; font-size: 1rem; text-decoration: none;
  border: 1px solid transparent; cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
}
.btn-primary { background: var(--accent); color: var(--accent-ink); box-shadow: var(--shadow); }
.btn-primary:hover { transform: translateY(-1px); }
.btn-ghost { background: transparent; color: var(--ink); border-color: var(--line-strong); }
.btn-ghost:hover { background: var(--bg-sunk); }
.btn[aria-disabled="true"] {
  background: var(--bg-sunk); color: var(--ink-faint);
  border-color: var(--line); box-shadow: none; cursor: not-allowed; transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .btn, .btn:hover { transform: none; transition: none; }
  html { scroll-behavior: auto; }
}

/* ── Sections ────────────────────────────────────────────────────────────── */
section { padding-block: clamp(3rem, 7vw, 5.5rem); }
section + section { border-top: 1px solid var(--line); }
.sunk { background: var(--bg-sunk); }
.eyebrow {
  display: inline-block; font-size: 0.78rem; font-weight: 660;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--accent); margin-bottom: 0.8rem;
}
.lede { font-size: clamp(1.06rem, 1rem + 0.4vw, 1.28rem); color: var(--ink-soft); max-width: 44ch; }
.section-head { max-width: 52ch; margin-bottom: clamp(1.8rem, 4vw, 2.8rem); }
.section-head p { color: var(--ink-soft); margin-bottom: 0; }

/* ── Hero ────────────────────────────────────────────────────────────────── */
.hero { padding-block: clamp(3.2rem, 9vw, 6.5rem); }
.hero .cta-row { display: flex; gap: 0.8rem; flex-wrap: wrap; margin-top: 2rem; }
.hero .note { margin-top: 1rem; font-size: 0.88rem; color: var(--ink-faint); }
.trust { display: flex; flex-wrap: wrap; gap: 0.55rem 1.4rem; margin-top: 2.4rem; padding: 0; list-style: none; }
.trust li { display: flex; align-items: center; gap: 0.45rem; font-size: 0.9rem; color: var(--ink-soft); }
.trust li::before { content: "✓"; color: var(--accent); font-weight: 700; }

/* ── Grids ───────────────────────────────────────────────────────────────── */
.grid { display: grid; gap: 1.1rem; }
.grid-2 { grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); }
.grid-3 { grid-template-columns: repeat(auto-fit, minmax(min(100%, 15.5rem), 1fr)); }

.card {
  background: var(--bg-raise); border: 1px solid var(--line);
  border-radius: var(--radius); padding: clamp(1.2rem, 3vw, 1.7rem);
}
.card h3 { margin-bottom: 0.4rem; }
.card p { color: var(--ink-soft); margin-bottom: 0; }
.card .num {
  display: grid; place-items: center;
  width: 2rem; height: 2rem; margin-bottom: 0.9rem;
  border-radius: 7px; background: var(--accent-wash);
  border: 1px solid var(--line);
  color: var(--accent); font-weight: 700; font-size: 0.9rem;
}

/* ── Pricing ─────────────────────────────────────────────────────────────── */
.price-grid { display: grid; gap: 1.1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr)); align-items: start; }
.tier {
  background: var(--bg-raise); border: 1px solid var(--line);
  border-radius: var(--radius); padding: clamp(1.3rem, 3vw, 1.8rem);
  display: flex; flex-direction: column; height: 100%;
}
.tier.featured { border-color: var(--accent); box-shadow: var(--shadow); }
.tier .tag {
  align-self: flex-start; font-size: 0.72rem; font-weight: 680;
  letter-spacing: 0.07em; text-transform: uppercase;
  background: var(--accent); color: var(--accent-ink);
  padding: 0.22rem 0.55rem; border-radius: 999px; margin-bottom: 0.85rem;
}
.tier .amount { display: flex; align-items: baseline; gap: 0.35rem; margin: 0.2rem 0 0.3rem; }
.tier .amount b { font-size: clamp(1.9rem, 1.5rem + 1.4vw, 2.5rem); font-weight: 680; letter-spacing: -0.03em; }
.tier .amount span { color: var(--ink-faint); font-size: 0.92rem; }
.tier .desc { color: var(--ink-soft); font-size: 0.95rem; }
.tier ul { list-style: none; padding: 0; margin: 1.1rem 0 1.4rem; }
.tier li { display: flex; gap: 0.55rem; font-size: 0.95rem; color: var(--ink-soft); }
.tier li::before { content: "✓"; color: var(--accent); font-weight: 700; flex: 0 0 auto; }
.tier .btn { margin-top: auto; width: 100%; }
.tier .fine { margin-top: 0.7rem; font-size: 0.8rem; color: var(--ink-faint); text-align: center; }

/* ── Quote ───────────────────────────────────────────────────────────────── */
figure.quote { margin: 0; }
figure.quote blockquote {
  margin: 0; font-size: clamp(1.1rem, 1rem + 0.6vw, 1.4rem);
  line-height: 1.5; color: var(--ink); border-left: 3px solid var(--accent);
  padding-left: clamp(1rem, 3vw, 1.6rem);
}
figure.quote figcaption { margin-top: 0.9rem; padding-left: clamp(1rem, 3vw, 1.6rem); color: var(--ink-faint); font-size: 0.9rem; }

/* ── FAQ ─────────────────────────────────────────────────────────────────── */
.faq { max-width: 48rem; }
.faq details { border-bottom: 1px solid var(--line); }
.faq details:first-of-type { border-top: 1px solid var(--line); }
.faq summary {
  cursor: pointer; padding: 1.05rem 2rem 1.05rem 0; position: relative;
  font-weight: 620; list-style: none;
}
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after {
  content: "+"; position: absolute; right: 0.25rem; top: 50%;
  transform: translateY(-50%); color: var(--accent);
  font-size: 1.3rem; font-weight: 400; line-height: 1;
}
.faq details[open] summary::after { content: "–"; }
.faq .answer { padding: 0 2rem 1.2rem 0; color: var(--ink-soft); }

/* ── Contact / final CTA ─────────────────────────────────────────────────── */
.final { text-align: center; }
.final .section-head { margin-inline: auto; }
.final .cta-row { display: flex; gap: 0.8rem; flex-wrap: wrap; justify-content: center; }
.pairs { display: grid; gap: 0.75rem 2rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); margin-top: 2.2rem; text-align: left; }
.pairs div { border-top: 1px solid var(--line); padding-top: 0.7rem; }
.pairs dt { font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-faint); }
.pairs dd { margin: 0.25rem 0 0; font-weight: 560; }

/* ── Footer ──────────────────────────────────────────────────────────────── */
.site-foot { border-top: 1px solid var(--line); background: var(--bg-sunk); padding-block: 2.4rem; font-size: 0.88rem; color: var(--ink-faint); }
.site-foot .row { display: flex; justify-content: space-between; gap: 1rem 2rem; flex-wrap: wrap; align-items: center; }
.site-foot a { color: var(--ink-soft); text-decoration: none; }
.site-foot a:hover { color: var(--ink); text-decoration: underline; }
.site-foot nav { display: flex; gap: 1.2rem; flex-wrap: wrap; }

/* ── Legal pages ─────────────────────────────────────────────────────────── */
.prose { max-width: 46rem; padding-block: clamp(2.5rem, 6vw, 4rem); }
.prose h1 { font-size: clamp(1.7rem, 1.4rem + 1.4vw, 2.3rem); }
.prose h2 { font-size: 1.2rem; margin-top: 2.2rem; }
.prose .updated { color: var(--ink-faint); font-size: 0.88rem; margin-bottom: 2rem; }
.prose table { width: 100%; border-collapse: collapse; margin: 0 0 1.5rem; font-size: 0.94rem; }
.prose th, .prose td { text-align: left; padding: 0.6rem 0.8rem; border-bottom: 1px solid var(--line); vertical-align: top; }
.prose th { color: var(--ink-faint); font-weight: 620; font-size: 0.82rem; letter-spacing: 0.04em; text-transform: uppercase; }
.table-scroll { overflow-x: auto; }
`.trim()
}
