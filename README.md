# Tracklist

A personal roller coaster ranking app for desktop and mobile, built with plain HTML, CSS, and JavaScript. No installation, account, API key, or backend is needed to use it.

## Run locally

With Node.js 18 or newer:

```sh
npm start
```

Open http://127.0.0.1:4173. No `npm install` is necessary to run or build the app. To run tests, use `npm ci` once, then `npm test`. Tests cover the data model and app interactions in jsdom; jsdom is a development dependency, never shipped to visitors. `npm run build` creates the deployable `dist/` folder. The source files can also be served directly by any static web server.

## Deploy to GitHub Pages

1. Push this repository to `main`.
2. In the GitHub repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
3. The included **Deploy Tracklist to GitHub Pages** workflow tests, builds, and deploys the app. Run it manually from Actions if necessary after enabling Pages. See [GitHub’s custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

The expected project URL for this repository is `https://cooldog19.github.io/Coater-Ranking/`. Deployment has to complete before this address is available. All app assets use relative paths, so project subpaths and custom domains work. You may also serve the repository root using “Deploy from a branch” if you prefer that Pages option.

## Using Tracklist

- Drag a six-dot handle with a mouse or touch to reorder. Dragging near a screen edge scrolls the page.
- Click a rank to jump directly to any position, to the top, or to the bottom.
- Select multiple rides to move a group. Their existing relative order is preserved. Shift-click selects a range. Destination rank is the first position of the moved group.
- Focus a handle and use arrow keys, Home, or End to reorder with the keyboard. `/` focuses search. Ctrl/Cmd+Z undoes collection changes outside text inputs.
- Keep new credits in **Unranked** until ready to place them. **All credits** shows the entire collection.
- Add individual rides or paste several lines using `Ride name | Park name`.
- Click a ride name or its details button to edit notes, park, type, country, manufacturer, date, and an HTTPS YouTube POV link. Without a saved POV, the video button searches YouTube for the ride.
- Undo keeps the last 30 changes in the current tab; it is cleared on reload.
- The initial sample collection is clearly marked. **Start my own list** removes sample rides while keeping any personal rides you have added. Reordering or editing samples keeps the banner available. The example notes are demonstration text, not imported user data.

## Saving and backups

The app automatically saves the entire collection to this browser’s `localStorage` after every change. It stays after a reload but does **not** sync between browsers or devices. Private browsing, clearing site data, or changing the hosting origin can remove or separate a collection. Export a JSON backup regularly, especially before changing hosts.

Use **Data & backup** or **Export backup** to download your collection. JSON preserves IDs and complete metadata. CSV preserves order and editable ride fields. Import presents a review, with the choice to replace everything or merge; merge retains existing details and skips matching ride names and parks, ignoring capitalization. Imported ranked rides are appended when merging. A replacement can be undone in the current tab.

If storage is blocked or full, a persistent warning tells you to export before closing the tab. Unreadable existing data is not silently overwritten; the Data & backup dialog offers a recovery download and an explicit reset. Changes made in another tab are reflected automatically; open dialogs are closed to prevent stale edits.

### CSV format

UTF-8 CSV (including a BOM), semicolon-delimited files, and TSV are supported. Quoted fields may contain commas, quotes, and newlines. A header and at least one data row are required.

```csv
name,park,rank,type,country,manufacturer,notes,pov,riddenOn
Steel Vengeance,Cedar Point,1,Hybrid,United States,Rocky Mountain Construction,Back row,,2026-07-14
New credit,Another park,,Steel,,,,,
```

Only the name is required. Supported name headers include `Name`, `Ride`, `Ride Name`, `Coaster`, `Coaster Name`, and `Roller Coaster`. Also supported: Park/Park Name/Location; Rank/Ranking/Position; Country; Type; Manufacturer/Builder; Notes/Comments; POV/YouTube/Video; Ridden On/Date. Positive integer ranks are ordered numerically; blank ranks are unranked. If the file has no rank column, imported rides go to Unranked. A `Ranked` column accepts true/yes/1. Dates use YYYY-MM-DD. POVs must be valid HTTPS YouTube URLs. Collections support up to 5,000 rides; imports are limited to 15 MB.

Tracklist does not connect to Coaster-Count or claim compatibility with every Coaster-Count export format. Use a compatible CSV or paste names. The sidebar provides a link to Coaster-Count for your existing credit-tracking workflow.

## Technical notes

All collection data stays on the device. There are no analytics or server calls for collection data. Google Fonts supplies DM Sans and Manrope, with local system-font fallbacks. YouTube and Coaster-Count open as external links. User content is escaped when rendered, imported records are validated, and unsafe POV URLs are rejected.

The app uses modern browser APIs (`dialog`, Pointer Events, local storage, Blob downloads). Current Chrome, Edge, Firefox, and Safari are the intended targets. No framework or runtime package dependencies are needed. Account-based saving on GitHub Pages would require an additional authenticated backend; this version deliberately uses portable backups instead.

Validation includes automated data and DOM interaction tests, JavaScript syntax checks, a static build, and local HTTP response checks. jsdom does not test actual CSS layout, real touch devices, or native download UI. The browser tool blocked the local preview during development, so visual desktop/mobile browser verification remains unperformed.
