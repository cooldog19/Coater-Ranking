# Tracklist

A personal coaster ranking and credit tracker for desktop and mobile. The static frontend runs on GitHub Pages; optional Firebase email/password accounts sync collections across devices. Local saving and downloaded backups work without an account.

## Run and deploy

Use Node.js 18 or newer. Run `npm start` and open http://127.0.0.1:4173. No installation is needed to run or build. For tests, run `npm ci` then `npm test`. `npm run build` creates `dist/` with all static assets; development packages are never shipped.

Push `main`, select **Settings → Pages → GitHub Actions**, and use the included deployment workflow. Relative asset paths support project subdirectories. See [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Public Web App configuration is in `firebase-config.js`. Follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md) to enable Email/Password, create the default Firestore database, publish [firestore.rules](firestore.rules), and authorize the website domain. GitHub Pages can remain the host. Firebase's [Spark plan](https://firebase.google.com/pricing) has free quotas; no billing account or paid server is required for modest personal use.

## Rank and track credits

- Drag a handle with mouse or touch to reorder. Edge dragging scrolls the page.
- Click a rank to jump to any position, top, or bottom.
- **Rank by comparison** quizzes unranked credits against your existing ranking, reranks one ride, or rebuilds all credits from scratch. Choose **Better**, **Worse**, **Much better**, or **Much worse**. Normal answers use binary insertion (at most nine comparisons for 500 reference rides); strong answers move the next question nearer the appropriate end without assuming untested comparisons. Back changes the previous answer, Skip preserves that ride, and each suggested position is reviewed before saving.
- Click a ride’s rank and choose **Compare to rerank**, or use **Add & compare** when logging new rides. A full rebuild compares against rides already processed in that quiz. As you save, processed rides are reordered in their existing ranking slots; unprocessed rides stay in place. Previously unranked rides get new ranking slots. On completion, the processed rides are in their new relative order, with skipped rides retaining their slots and ranking status.
- Pause or close the quiz to resume later. Pending answers are saved locally per account on this device; they are not synced or included in exported backups. Confirmed placements use the normal collection saving, cloud sync, recovery, and undo. Changes to the ranking or credit membership invalidate a paused quiz so it cannot apply outdated comparisons.
- Select several rides and move them together; shift-click selects a range. Relative order is preserved.
- Focus a handle and use arrows, Home, or End. Ctrl/Cmd+Z undoes changes outside text inputs; / focuses search.
- New logged credits go to **Unranked**. **All credits** includes every ridden ride. Use the single **Edit** action to change notes, first-ridden date, details, POV, or RCDB URL.
- **Explore parks** searches the bundled catalog by park, ride, manufacturer, and country. Select a park to see its catalog rides. Filter current/status-unknown entries or include historic/planned rides.
- **Add to wish list** saves a park to visit. Open saved parks to see all catalog rides and your logged credits. You can also wish for individual rides. **Log credit** adds it instantly, fills metadata and available links, and removes that individual ride wish. Saved parks remain until you remove them. Matching RCDB IDs or names/parks prevent duplicate logging.
- **Add a ride** includes catalog autofill and manual entry for missing rides. You can also paste multiple lines as `Ride | Park`.
- The initial sample is clearly marked. **Start my own list** removes demonstration rides while retaining personal additions. New accounts copy personal additions and planned rides, excluding samples.

The catalog currently contains **4,232 rides across 1,710 park groups** from public Coasterpedia articles and supplemental Wikidata entries. It is a dated community snapshot, with incomplete coverage and non-live statuses. Historic names help match imported credits. Source links, RCDB ride pages, and available direct YouTube POVs are included; search links are offered when a direct link is missing. No video or article media is copied. Attribution and reuse terms are in [CATALOG_LICENSE.md](CATALOG_LICENSE.md).

## Import credits

Open **Data & backup → Import credits**. Paste a ride table, enter lines as `Ride | Park`, or choose a saved HTML, CSV, or TSV file. Review catalog matches before importing. Existing credits and notes are kept; new credits start unranked. Saved HTML requires a table with recognizable Name/Coaster Name and Park headers. Imported scripts are never executed.

## Saving, recovery, and sync

The header has explicit **Log in** and **Log out** controls. **Create account** is a separate tab in the login dialog. Guest status means this device only; **Account saved** confirms a cloud revision. Offline, blocked, pending, and conflicting account saves have distinct status text.

Every change saves to browser localStorage first. Private browsing, clearing site data, changing the site origin, or full storage can lose that copy. The app reports saving failures and keeps editing/export available. Unreadable saved data is preserved until an explicit replacement, with a recovery-file download.

**Export JSON** is the complete independent backup: ranking, notes, metadata, saved parks, and individual ride wishes. CSV contains credits only, including ranking and links. Potential spreadsheet formulas are prefixed with an apostrophe; use JSON for exact backups. Import offers merge or replacement. Merge keeps existing order and notes, skips matching names/parks or RCDB IDs, and appends new ranked rides. Undo keeps 30 changes in this tab. Up to 10 local recovery checkpoints per collection are kept within a shared 2 MB budget; they disappear if browser data is cleared.

With an account, a one-second debounce uploads edits to Firestore. Cloud saves retain 10 revisions and use transactions to prevent silent overwrites by other devices. A conflict offers **Use cloud**, **Merge both**, or **Use this device**, plus a backup download. Merge keeps the cloud ranking/notes and adds missing local credits; it cannot combine conflicting note edits or ranking orders. Offline changes stay local and retry when connected. Oversized sync payloads (over 6 MB) remain local and exportable. Guest and account collections have separate local copies; signing out returns to the guest collection.

### CSV format

CSV, semicolon-delimited files, TSV, UTF-8 BOMs, quoted commas, quotes, and multiline fields are supported. A header and data row are required.

```csv
name,park,rank,type,country,manufacturer,notes,pov,riddenOn,rcdb
Steel Vengeance,Cedar Point,1,Hybrid,United States,Rocky Mountain Construction,Back row,,2026-07-14,https://rcdb.com/15411.htm
New credit,Another park,,Steel,,,,,,
```

Only name is required. Name/Ride/Coaster/Coaster Name/Roller Coaster; Park/Park Name/Location; Rank/Ranking/Position; Country; Type; Manufacturer/Builder; Notes/Comments; POV/YouTube/Video; Ridden On/Date; RCDB/RCDB ID are recognized. Dates use real YYYY-MM-DD dates. Positive integer ranks are ordered numerically; blank ranks are unranked. No rank column means all entries go to Unranked. POVs require HTTPS YouTube links; RCDB links require a ride page. Collections and wish lists each support up to 5,000 entries; file imports are limited to 15 MB. Catalog-derived exports preserve source and license metadata.

## Maintenance and verification

Visitors search the bundled catalog without provider requests. Refresh commands are maintenance operations, not deployment steps: `node scripts/update-catalog.cjs` fetches Wikidata, then `node scripts/update-coasterpedia.cjs` combines public wiki articles. The latter resumes an ignored `test-results/catalog-cache/`; remove that exact cache directory for a fresh article fetch. Review the resulting catalog before committing. Full attribution is retained per article revision.

The app uses plain HTML/CSS/JS and modern browser APIs (dialog, Pointer Events, localStorage, Blob). Firebase SDK 12.19.0 loads from Google's CDN for auth/sync; no analytics are initialized. Google Fonts has system-font fallbacks. Collection data goes only to the configured Firebase project when signed in. External video, RCDB, and source links open separately.

Automated tests cover ranking, pointer/keyboard interactions, imports, catalog logging, wish lists, account isolation, recovery, offline queues, concurrent revisions, unsafe HTML/links, formula-safe CSV, and deployment artifact boundaries. DOM tests use jsdom; actual browser layout and CDN/CSP behavior need checking on the deployed site. Emulator tests exercise the real Firestore rule engine; they require the setup in [SECURITY.md](SECURITY.md). The live rules and provider console settings must also be verified before public release.

Run `npm run security:check -- --history` to scan tracked/current files, repository history and the build for credential and machine-path patterns. See [SECURITY.md](SECURITY.md) for the security boundary and release checks.
