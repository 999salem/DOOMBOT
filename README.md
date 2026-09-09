# DOOMBOT — S.A.L.E.M. Doomsday Intelligence Matrix

Created & curated by **999SALEM**.

A Doom-themed Avengers: Doomsday intelligence site for tracking official reporting, leaks, visual evidence, personal theories, source reliability, and a connected theory map.

## What works

- Doom-themed responsive UI with live **Doomsday** and **Endgame: Encore** countdowns
- Visual leak gallery with source trails
- 999SALEM original theories + sourced theory remixes
- Interactive evidence/theory constellation
- Theory search and filters
- Lock predictions before new information comes out
- Private per-theory notes stored in the browser
- S.A.L.E.M. Analyst Desk for grading new claims
- Local intel queue stored in the browser
- Live Intel Monitor backed by `data/live-intel.json`
- GitHub Action that refreshes public RSS/news results every 6 hours
- Installable PWA / Add to Home Screen support
- Offline app shell via service 
## Live Intel

GitHub Pages is static, so the browser itself should not be used to scrape X, Reddit, or news sites. Instead:

- `.github/workflows/refresh-intel.yml` runs `scripts/refresh_intel.py` on a schedule.
- `data/feeds.json` controls public RSS feeds.
- `data/source-tiers.json` controls automatic source-tier estimates.
- The script writes `data/live-intel.json`.
- The website reads that JSON and renders the Live Intel Monitor.

Social leaks remain manual by design. Add them through the Analyst Desk or edit the gallery after checking the source trail.

## Easy customization

- Main page: `index.html`
- Visual design: `assets/css/styles.css`
- Interactions: `assets/js/app.js`
- Live-source data: `data/live-intel.json`
- Source tier rules: `data/source-tiers.json`
- Automatic feeds: `data/feeds.json`

## PWA / iPhone

Once the site is hosted over HTTPS on GitHub Pages, open it in Safari and use **Share → Add to Home Screen**. The included manifest, icons and service worker make it behave more like its own app.

## Source policy

This project deliberately separates:

- **Tier S:** official first-party material
- **Tier A:** major trades / wire services
- **Tier B:** established entertainment press / tracked sources
- **Tier C:** unverified social or general rumor reporting
- **Tier D:** anonymous/reposted claims

A cool theory is not automatically a good leak. A widely reposted leak is not automatically corroborated.

## Image note

The current gallery links to third-party public image/source URLs rather than redistributing those files inside this repository. Remote images can disappear; the UI includes a fallback and the source links remain attached.

## Countdown dates

- **Avengers: Endgame — Encore:** September 25, 2026
- **Avengers: Doomsday:** December 18, 2026

The on-page counters use the visitor's local clock and update every second.

## V11 visual leak database

The site now includes **25 leak database files** (20 image records plus 5 source-only discussion/footage threads).

Images use three layers of resilience:

1. Local thumbnail in `assets/images/leaks/` when cached.
2. `images.weserv.nl` proxy fallback if the local cache is missing.
3. Original remote source as a final fallback, then a clean source-only placeholder.

### Cache the photos into your repo

After uploading the repo to GitHub, open **Actions → Cache leak images → Run workflow**. The workflow downloads public source images, resizes them to editorial thumbnails, and commits them into `assets/images/leaks/`. After that, the gallery no longer depends on the original host for normal page loads.

The workflow also runs twice a week and whenever `data/leak-images.json` changes.

## V12 app layout

DOOMBOT is now a multi-page app instead of one giant scrolling document.

- `index.html` — Command Center: Doomsday countdown + Endgame Encore countdown + theory constellation
- `intel.html` — live/public intel monitor
- `leaks.html` — visual leak database
- `theories.html` — 999SALEM theory archive
- `analyst.html` — S.A.L.E.M. source-confidence desk
- `about.html` — project / methodology

On phones, a persistent bottom navigation bar makes the main modules one tap away.

## V17
- permanent Add Theory control
- Post-Credit Archive (`credits.html`)
- Leaked Plot spoiler archive (`plot.html`)
- expanded visual database to 30 archive files
- cloud save and repair workflows preserved

## V18 — The War Room
Accounts, profiles, roles, guest-readable discussions, replies, voting, saved threads, spoiler controls, reports, muting, moderation and personal-theory sharing.
