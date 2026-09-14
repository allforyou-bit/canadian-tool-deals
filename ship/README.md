# 48-Hour Ship

> **The money routes and what each needs from you: [`MONEY.md`](MONEY.md).**
> Facts and their sources: [`FINDINGS.md`](FINDINGS.md). Day-to-day: [`sales/runbook.md`](sales/runbook.md).

A zero-dependency static site generator plus the sales kit that goes with it.

One brief JSON in, one deployable site out: a responsive single-page site with the
client's own checkout wired in, plus `/privacy` and `/terms`. Built to be deployed
on Cloudflare Pages, which is the only major free host verified to permit
revenue-generating commercial use.

## Why these choices

- **Cloudflare Pages, not Vercel Hobby.** Vercel's Fair Use Guidelines restrict
  Hobby teams to "non-commercial personal use only" and name "any method of
  requesting or processing payment from visitors of the site" as commercial usage.
  GitHub Pages is likewise "not intended for or allowed to be used as a free
  web-hosting service to run your online business, e-commerce site, or any other
  website that is primarily directed at either facilitating commercial
  transactions". Cloudflare's free plan restricts usage (100k dynamic
  requests/day, 10 ms CPU per invocation, unlimited free static asset requests) but
  not commercial purpose.
- **Static output, no Worker.** Static asset requests on Cloudflare Pages are free
  and unlimited and never touch the 10 ms CPU budget. Nothing here needs a runtime.
- **Zero dependencies.** Node built-ins only. Nothing to install, nothing to audit,
  and a cold CI build takes seconds.

## Build

```bash
node ship/build.mjs            # build every brief in ship/briefs
node ship/build.mjs acme-co    # build one brief
node ship/build.mjs --check    # validate briefs without writing output
```

Output lands in `ship/dist/<slug>/`. The service's own landing page is built from
`ship/briefs/_site.json` and lands at `ship/dist/index.html`.

## Checks

```bash
node ship/build.mjs --check            # brief validation, writes nothing
node ship/tools/preview.mjs --check    # horizontal overflow at 390 / 1280, light and dark
node ship/tools/contrast.mjs           # WCAG AA on the colours the browser computed
node ship/tools/selftest.mjs           # escaping, href filtering, no cookies, no external requests
node ship/tools/links.mjs              # serves the build and requests every internal link
node ship/tools/preview.mjs --out ./shots   # the same run, with PNGs
```

Both run in CI on every push. They exist because the landing page makes two
claims — that these pages work on a phone and read properly in dark mode — and a
claim that is never checked is a claim that quietly stops being true.

`ship/tools/contrast.mjs` measures computed colour, not the tokens in the
stylesheet, so `color-mix()`, inheritance and stacked backgrounds are all
accounted for. `--ink-faint` is pinned to the darkest value that still clears
4.5:1 against every background it can land on; lightening it fails the sunk
background first.

## Invoices

```bash
cp ship/sales/invoices/_example.json ship/sales/invoices/2026-002.json
node ship/tools/invoice.mjs ship/sales/invoices/2026-002.json            # HTML + PDF
node ship/tools/invoice.mjs ship/sales/invoices/2026-002.json --receipt  # paid version
```

PDFs are printed through the same headless browser, so there is no PDF library to
keep current. The tool refuses to run while a `REPLACE-` placeholder remains, and
prints no GST/HST line unless a `tax` block with a registration number is present.
Generated invoices are gitignored: they carry client names.

## Deploying

Cloudflare Pages, connected to this GitHub repository once by hand:

- Build command: `node ship/build.mjs`
- Build output directory: `ship/dist`
- No environment variables, no secrets.

After that one-time connection every push deploys automatically.

## Brief format

See `ship/briefs/_schema.md` for every field, and `ship/briefs/sample-*.json` for
three complete worked examples.

## Two modes

`"mode": "proposal"` renders a `noindex, nofollow` page carrying a visible
"unaffiliated proposal" banner, for showing someone what their page could look
like before they have hired anyone. `"mode": "live"` renders the delivered site,
indexable, with the banner gone.

Proposal pages are never advertised, never linked from the landing page and never
submitted to a search engine. They exist to be sent to the one person who asked.
