# Archived: Canadian Tool Deals (price comparison)

This was the previous project in this repository. It was archived on 2026-09-23 because
its scrapers had returned 0 live prices in every daily snapshot since 2026-08-08
(see `git log -- public/cache/index.json` on `master`), so it was not producing value.

- Nothing in this folder is built, linted or deployed.
- The daily scrape GitHub Action was moved here (`.github-workflows/scrape.yml`) so it no longer
  runs from this branch. The copy on `master` is unchanged.
- To restore: move the files back to their original paths (`git log --follow` shows them).
