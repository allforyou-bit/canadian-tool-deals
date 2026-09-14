# Brief format

One JSON file per site, named anything ending in `.json`. `_site.json` is special:
it builds to the output root instead of a subdirectory. Other files starting with
`_` are ignored by the build, so notes can live here too.

Run `node ship/build.mjs --check` after every edit. Errors name the exact field
path and block the build; warnings print and let it through.

## Top level

| Field | Required | Notes |
| --- | --- | --- |
| `slug` | yes | lowercase letters, digits, hyphens. Becomes the output directory. |
| `mode` | yes | `live` or `proposal`. See below. |
| `meta` | yes | identity and head tags |
| `proposal` | when `mode: proposal` | who this was prepared for, and by whom |
| `hero` | yes | the first screen |
| `nav` | no | array of `{ label, href }` |
| `alternates` | no | sibling-language versions — see below |
| `sections` | yes | ordered array, at least one |
| `contact` | no | `email`, `phone`, `address`, `hours` |
| `legal` | yes | drives the privacy and terms pages |
| `footer` | no | `{ note }` |

## `meta`

`businessName`, `tagline`, `description` required. Optional: `title` (overrides the
generated `<title>`), `monogram` (1–2 characters, derived from the name otherwise),
`locale` (default `en-CA`), `url` (enables canonical tags and a sitemap — omit
until the real URL is known), `accent`.

Accents: `slate`, `blue`, `teal`, `green`, `amber`, `rust`, `crimson`, `violet`.
Each carries a light value, a dark value and a readable foreground, so a page stays
legible in both themes whichever one is chosen.

## `mode`

`live` renders the delivered site: indexable, canonical tag, sitemap, structured
data.

`proposal` renders a draft to show one person: `noindex, nofollow, noarchive`, a
`Disallow: /` robots file, no structured data, no sitemap, and a banner at the top
of every page stating that the page is unaffiliated, who prepared it, and that
nothing is live. The banner is not optional and cannot be switched off — a page
showing a business what their site could look like must never be mistakable for
the business's own.

## `alternates` — the bilingual package

A site in two languages is two briefs, not one brief with a translation table. That
is deliberate: the Ship Two package sells Korean that was *written*, and a
key-value translation layer quietly pushes you back toward machine output.

```jsonc
// acme.json
"meta":  { "locale": "en-CA" },
"alternates": [{ "lang": "ko", "label": "한국어", "href": "/acme-ko/" }]

// acme-ko.json
"meta":  { "locale": "ko-KR" },
"alternates": [{ "lang": "en", "label": "English", "href": "/acme/" }]
```

| Field | Required | Notes |
| --- | --- | --- |
| `lang` | yes | a language tag: `ko`, `en`, `ko-KR` |
| `label` | yes | what the switcher shows — write it in its own language |
| `href` | yes | the sibling's output directory, `/like-this/` |
| `url` | no | the sibling's real deployed URL, once known |

**The links must be reciprocal.** A full build fails if a sibling does not link
back, or points at a directory nothing builds. A one-way switcher strands the
reader in the language they just left, and it is the kind of mistake that survives
every check that looks at one page at a time.

`meta.locale` drives everything else: `<html lang>`, the interface strings, the
date format on the legal pages, and the whole privacy and terms copy, which is
written in Korean rather than translated. Korean pages also get
`word-break: keep-all`, without which the browser splits words mid-syllable — the
clearest sign a Korean page was laid out by someone who does not read Korean.

`hreflang` tags are emitted only when both this brief's `meta.url` and the
sibling's `alternates[].url` are set, because hreflang is specified in fully
qualified URLs. The visible switcher works regardless; a wrong machine hint is
worse than none.

## `sections`

Each entry needs a `type`. All accept optional `eyebrow`, `heading`, `intro`, `id`
and `sunk` (renders on the alternate background).

| `type` | Shape |
| --- | --- |
| `features` | `items: [{ title, body }]` — card grid |
| `steps` | `items: [{ title, body }]` — numbered card grid |
| `quote` | `text`, `attribution` |
| `pricing` | `tiers: [{ name, amount, unit?, desc?, tag?, includes?, cta?, fine?, featured? }]` |
| `faq` | `items: [{ q, a }]` — native `<details>`, no JavaScript |
| `text` | `body` — string or array of strings |
| `final` | `primaryCta?`, `secondaryCta?`, `pairs?: [{ label, value }]` |

A `cta` is `{ label, href }`. `href` may be omitted, which renders the button
visibly inert rather than linking somewhere wrong — that is the normal state on a
proposal page, where the client's own checkout link does not exist yet.

Hrefs must start with `http://`, `https://`, `mailto:`, `tel:`, `#` or `/`.
Anything else is a build error.

## Copy fields accept a little markdown

`**bold**`, `*italic*`, `` `code` `` and `[text](url)` work in headings, body copy,
list items and answers. Everything is escaped first, so a `&` or a `<` in a
business name is safe.

## `legal`

| Field | Required | Notes |
| --- | --- | --- |
| `operator` | yes | the name that appears on the page and in the terms |
| `jurisdiction` | yes | e.g. `Ontario, Canada` |
| `contactEmail` | yes | privacy and terms contact |
| `effective` | yes | `YYYY-MM-DD`, real calendar date, shown as "last updated" |
| `collects` | no | array of plain-language lines about what the site collects |
| `refund` | no | overrides the default refund paragraph |
| `deliverable` | no | what the terms apply to, beyond the site itself |

## Operator substitution

Any string in a brief may contain `{{operator.legalName}}`, `{{operator.email}}`,
`{{operator.jurisdiction}}` or `{{operator.jurisdictionKo}}`. The build replaces
them from `ship/operator.json` before validation, so the operator's own details
live in one file rather than in every brief.

An unknown key is left in the output as written and warned about, rather than
replaced with an empty string.

Any string containing `REPLACE-` produces a warning on every build until it is
replaced — including one that arrived through a substitution. That is how the
operator's own legal name is handled: it is not guessed.
