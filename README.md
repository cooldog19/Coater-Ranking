# Tracklist

A personal coaster ranking and credit tracker for desktop and mobile. The static frontend runs on GitHub Pages; optional Firebase email/password accounts sync collections across devices. Local saving and downloaded backups work without an account.

## Run and deploy

Use Node.js 18 or newer. Run `npm start` and open http://127.0.0.1:4173. No installation is needed to run or build. For tests, run `npm ci` then `npm test`. `npm run build` creates `dist/` with all static assets; development packages are never shipped.

Push `main`, select **Settings → Pages → GitHub Actions**, and use the included deployment workflow. The expected URL is https://cooldog19.github.io/Coater-Ranking/ after deployment. Relative asset paths support project subdirectories. See [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Your public Firebase configuration for **coasterlist** is included. Follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md) to enable Email/Password, create the default Firestore database, publish [firestore.rules](firestore.rules), and authorize the website domain. GitHub Pages can remain the host. Firebase's [Spark plan](https://firebase.google.com/pricing) has free quotas; no billing account or paid server is required for modest personal use.

## Rank and track credits

- Drag a handle with mouse or touch to reorder. Edge dragging scrolls the page.
- Click a rank to jump to any position, top, or bottom.
- Select several rides and move them together; shift-click selects a range. Relative order is preserved.
- Focus a handle and use arrows, Home, or End. Ctrl/Cmd+Z undoes changes outside text inputs; / focuses search.
- New logged credits go to **Unranked**. **All credits** includes every ridden ride. Click a ride to edit notes, first-ridden date, details, POV, or RCDB URL.
- **Explore parks** searches the bundled catalog by park, ride, manufacturer, and country. Select a park to see its catalog rides. Filter current/status-unknown entries or include historic/planned rides.
- **Plan ride** adds a coaster to your trip list without counting it as a credit. **Log credit** adds it instantly, fills metadata and available links, and removes it from the trip list. Matching RCDB IDs or names/parks prevent duplicate logging.
- **Add a ride** includes catalog autofill and manual entry for missing rides. You can also paste multiple lines as `Ride | Park`.
- The initial sample is clearly marked. **Start my own list** removes demonstration rides while retaining personal additions. New accounts copy personal additions and planned rides, excluding samples.

The catalog currently contains **4,232 rides across 1,710 park groups** from public Coasterpedia articles and supplemental Wikidata entries. It is a dated community snapshot, with incomplete coverage and non-live statuses. Historic names help match imported credits. Source links, RCDB ride pages, and available direct YouTube POVs are included; search links are offered when a direct link is missing. No video or article media is copied. Attribution and reuse terms are in [CATALOG_LICENSE.md](CATALOG_LICENSE.md).

## Move your Coaster-Count list

Open **Data & backup → Import Coaster-Count list**. On Coaster-Count, open your **Ridden coasters** page and either copy its ride table, save it as HTML, or use a CSV/TSV export if your account provides one. Paste the table or choose the saved file. **Review credits** matches names, former names, parks, and RCDB links where available. Review ambiguous matches, exclude unwanted rows, and import. Existing credits and personal notes are retained; new credits start unranked. Unmatched rides can be kept as entered.

Supported copied lists include a Name/Coaster Name and Park header, or plain `Ride | Park` lines. Saved HTML needs a table with recognizable ride-name headers. The importer processes text locally and does not run imported scripts. No Coaster-Count password is requested.

Coaster-Count's [published API](https://fr.coaster-count.com/cc_api_documentation.pdf) documents counts/statistics rather than a full detailed personal ride-list endpoint suitable for this static site. This app therefore provides file/table migration, not automatic account synchronization. A universal export button or every account's table layout has not been verified; review the parsed list before importing.

## Saving, recovery, and sync

Every change saves to browser localStorage first. Private browsing, clearing site data, changing the site origin, or full storage can lose that copy. The app reports saving failures and keeps editing/export available. Unreadable saved data is preserved until an explicit replacement, with a recovery-file download.

**Export JSON** is the complete independent backup: ranking, notes, metadata, and trip list. CSV contains credits only, including ranking and links. Import offers merge or replacement. Merge keeps existing order and notes, skips matching names/parks or RCDB IDs, and appends new ranked rides. Undo keeps 30 changes in this tab. Up to 10 local recovery checkpoints per collection are kept within a shared 2 MB budget; they disappear if browser data is cleared.

With an account, a one-second debounce uploads edits to Firestore. Cloud saves retain 10 revisions and use transactions to prevent silent overwrites by other devices. A conflict offers **Use cloud**, **Merge both**, or **Use this device**, plus a backup download. Merge keeps the cloud ranking/notes and adds missing local credits; it cannot combine conflicting note edits or ranking orders. Offline changes stay local and retry when connected. Oversized sync payloads (over 6 MB) remain local and exportable. Guest and account collections have separate local copies; signing out returns to the guest collection.

### CSV format

CSV, semicolon-delimited files, TSV, UTF-8 BOMs, quoted commas, quotes, and multiline fields are supported. A header and data row are required.

```csv
name,park,rank,type,country,manufacturer,notes,pov,riddenOn,rcdb
Steel Vengeance,Cedar Point,1,Hybrid,United States,Rocky Mountain Construction,Back row,,2026-07-14,https://rcdb.com/15411.htm
New credit,Another park,,Steel,,,,,,
```

Only name is required. Name/Ride/Coaster/Coaster Name/Roller Coaster; Park/Park Name/Location; Rank/Ranking/Position; Country; Type; Manufacturer/Builder; Notes/Comments; POV/YouTube/Video; Ridden On/Date; RCDB/RCDB ID are recognized. Dates use real YYYY-MM-DD dates. Positive integer ranks are ordered numerically; blank ranks are unranked. No rank column means all entries go to Unranked. POVs require HTTPS YouTube links; RCDB links require a ride page. Collections and trip lists each support up to 5,000 entries; file imports are limited to 15 MB. Catalog-derived exports preserve source and license metadata.

## Maintenance and verification

Visitors search the bundled catalog without provider requests. Refresh commands are maintenance operations, not deployment steps: `node scripts/update-catalog.cjs` fetches Wikidata, then `node scripts/update-coasterpedia.cjs` combines public wiki articles. The latter resumes an ignored `test-results/catalog-cache/`; remove that exact cache directory for a fresh article fetch. Review the resulting catalog before committing. Full attribution is retained per article revision.

The app uses plain HTML/CSS/JS and modern browser APIs (dialog, Pointer Events, localStorage, Blob). Firebase SDK 12.19.0 loads from Google's CDN for auth/sync; no analytics are initialized. Google Fonts has system-font fallbacks. Collection data goes only to the configured Firebase project when signed in. External video, RCDB, and source links open separately.

Automated tests cover ranking, pointer/keyboard interactions, imports, catalog logging, trip lists, account isolation, recovery, offline queues, concurrent revisions, and stale async completions. Build, syntax, and HTTP asset checks supplement them. DOM tests use jsdom and do not verify CSS layout or real touch devices. The browser tool blocked local preview during development, so visual desktop/mobile verification remains unperformed. Authentication setup responds successfully; signed-in Firestore rules and real cross-device saving require verification with your account after console setup.
