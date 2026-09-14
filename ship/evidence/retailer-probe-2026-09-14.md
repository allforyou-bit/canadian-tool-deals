# Retailer reachability probe — 14 September 2026

Transcribed from the GitHub Actions runs on the temporary `diag/scraper-probe`
branch, because Actions logs are retained for a limited period and
`ship/FINDINGS.md` cites them. The branch itself has been deleted; this file is
the record.

Runs: `34838842077`, `34839207465`, `34839469034` — all `workflow_dispatch`, all
read-only, all succeeded. Every request below was made from a GitHub Actions
`ubuntu-latest` runner, which has open network access, unlike the build container
the agent works in.

## Canadian Tire — blocked at the edge, internal API gone

```
[https://api.canadiantire.ca/search/api/v0/product/en/?q=drill&store=0144&...]
  ERR fetch failed
[https://apim.canadiantire.ca/v1/search/v2/search?store=0144&q=drill&...]
  HTTP 403 ct=text/html len=410  <HTML><HEAD><TITLE>Access Denied</TITLE>...
[https://apim.canadiantire.ca/v1/search/search?store=0144&q=drill&...]
  HTTP 403 ct=text/html len=403  <HTML><HEAD><TITLE>Access Denied</TITLE>...
[https://www.canadiantire.ca/]
  HTTP 403 server=AkamaiGHost len=373  Access Denied
```

The domain 403s datacenter IPs at the Akamai edge, and the internal API the
scraper hardcodes no longer exists.

## Home Depot Canada — connection blackhole, not a 403

```
[https://www.homedepot.ca/]              ERR This operation was aborted
[https://www.homedepot.ca/robots.txt]    ERR This operation was aborted
[https://www.homedepot.ca/en/home.html]  ERR This operation was aborted
[https://api.homedepot.ca/]              HTTP 200 len=15
```

No response at all from the storefront — not a refusal, a silence. Requests hang
until the 12-second timeout. `api.homedepot.ca` answers with 15 bytes, which is a
health endpoint rather than a product API.

## Best Buy Canada — answers, and still cannot be used

`robots.txt` does not mention `/api`. It disallows `/search/`, `/en-ca/Search`,
`/Search/` and the account, basket, checkout and order paths, and explicitly
allows `/en-ca/product/`, `/en-ca/category/`, `/en-ca/brand/`.

An internal store endpoint returned:

```
HTTP 200 total=227
  {"sku":"19342468","name":"MS TECH (6FT Long) AC Power Cord Cable Compatible with DEWAL",
   "regularPrice":10,"salePrice":10,"hasPromotion":false,"saleEndDate":null,
   "url":"/en-ca/product/ms-tech-...-jobsite-speaker/19342468"}
  {"sku":"15396526","name":"ISTAR Oscillating Saw Blades, 10pcs 34mm ...",
   "regularPrice":56.33,"salePrice":22.53,"hasPromotion":true,"saleEndDate":null, ...}
```

Real prices, sale flags and promotion end dates, 227 results, HTTP 200.

**This is not a route.** Best Buy Canada's Conditions of Use prohibit "framing,
mirroring, scraping or data-mining of the Website or any of its content in any
form and by any means" and using "any robot, spider or other automatic device,
process or means to access the Site". The endpoint above is the website's own
internal API, not a public developer programme. It is a terms breach that happens
to return 200 rather than 403.

A product detail page fetched fine (`HTTP 200 len=235437`) but carried no usable
JSON-LD (`ldBlocks=0`), so even the structured-data route is not there.

## RedFlagDeals — a published RSS feed

```
HTTP 200 first titles:
  - redflagdeals.com Forums - Hot Deals
  - [Amazon.ca] MOSFiATA 7" Santoku Kitchen Knife – $25.51
  - [Costco] Uber/Uber Eats Gift Cards $50x2 for 79.99 Now Live Online
  - [Pharmasave] Blue Rewards Flash Offer: 1500 Bonus Points ... (Sep 17-19)
  - [Costco] Titan Pro - 26 Can Backpack Cooler
```

An RSS feed is published to be consumed, which is the one meaningful difference
from everything above. Consumption is not republication: a feed does not license
reproducing items in full, and RFD's own terms on this were not located.
Headline, price, link back and clear attribution is the defensible boundary.

## What this establishes

The price cache is empty because the retailers refuse datacenter IPs at the CDN
edge, not because the selectors drifted. Header spoofing does not change that. The
two sources that do answer are unusable for a different reason — one contractual,
one licensing — so there is no compliant zero-cost route to a six-retailer
Canadian price feed.
