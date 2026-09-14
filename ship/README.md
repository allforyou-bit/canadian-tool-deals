# 48-Hour Ship

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
