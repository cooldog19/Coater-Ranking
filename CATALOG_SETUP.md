# Automatic catalog updates

Tracklist can keep GitHub Pages and Firebase. GitHub Actions fetches the public ride catalog using a secret provider key; visitors search the resulting static files. No paid server, Firebase admin key, database migration or iOS development is required.

**Current state:** the checked-in catalog still contains the existing 4,232-ride snapshot. It has been converted to the new file format, not freshly downloaded. `catalog-manifest.json` correctly says `initialized: false` and `lastCheckedAt: null`. Automatic updates remain off until you complete the steps below. The authenticated API importer has automated fixture coverage; its first real import needs your provider key and inventory review.

## 1. Merge this update

Review and merge `feature/automatic-catalog-updates` into `main`, then push `main` to GitHub. These instructions assume the existing repository and a public GitHub Pages site.

In **Settings → Pages**, keep **Source: GitHub Actions**. Confirm the existing **Deploy Tracklist to GitHub Pages** workflow is enabled and passes. The new catalog workflow intentionally runs only on `main`.

## 2. Get a Coasterpedia key

Create/sign in to a Coasterpedia account, confirm its email, then open [Your keys in the developer portal](https://developer.coasterpedia.net/account/keys). Create a dedicated key for Tracklist and copy it directly to GitHub in the next step; the portal shows it once. See the provider's [getting-started guide](https://developer.coasterpedia.net/docs/).

Read the [API terms](https://developer.coasterpedia.net/terms/) before using a free key. A free, ad-free fan app qualifies; advertising, purchases, paid features or business use require a separate arrangement. Keep the required attribution. The derived public data is CC BY-SA 4.0; your code, original rankings and private notes are separate. The cache serves Tracklist's own app; do not turn it into a replacement bulk-data service. The old bulk wiki crawler is retired.

## 3. Save the key in GitHub

Open your repository → **Settings → Secrets and variables → Actions → Secrets → New repository secret**:

| Name | Value |
| --- | --- |
| `COASTERPEDIA_API_KEY` | The key from the provider portal |

Do **not** use a repository variable for the key. Do not put it in `firebase-config.js`, frontend JavaScript, a committed `.env`, an issue, a screenshot or a future mobile app. The workflow passes it only to the maintenance fetch step, not to the build or browser. If it leaks, revoke it in the provider portal and replace the GitHub secret.

Under **Settings → Actions → General**, allow the included workflows to run. Repository/organization policies must permit `GITHUB_TOKEN` to write repository contents and dispatch workflows. The updater requests only `contents: write` and `actions: write`. It needs neither a personal access token nor permission to access Firebase. Keep normal branch protection; see troubleshooting if it prevents automated commits.

## 4. Preview the first complete import

Go to **Actions → Refresh public coaster catalog → Run workflow**, choose branch **main**, and set:

| Input | First preview |
| --- | --- |
| operation | `bootstrap` |
| publish | unchecked |
| approve_large_change | unchecked |

This enumerates coaster and park IDs, fetches full records, replays edits made during the import and prepares a candidate in the runner's temporary checkout. It does not commit or deploy the preview. A full bootstrap may take several minutes.

Download the **catalog-review-…** artifact on the run's summary page. It expires after one day. It contains the candidate public JSON/manifest and the review report, never the key or user collections. If the run is held for a large change, a red result is expected: inspect `review.txt` and `review.json` before approving anything.

Review these items:

- Added/removed rides, status changes, changed names, parks, manufacturers, track counts and RCDB links. More than 2% removed rides, more than 10% changed statuses, a park-count drop over 10%, or loss of more than 10% of known manufacturer/country/park/RCDB/type coverage requires explicit approval.
- A few familiar parks, newly opened/announced rides, historic rides, travelling coasters, same-name parks in different countries, and your multi-track examples. Search `catalog.json` for their names. Compare source links to official park information where needed.
- `normalizationWarnings`, especially ambiguous RCDB links. Conflicting direct links are cleared from the public candidate and replaced by the app's RCDB search fallback; private saved links are untouched. Review warnings even if the run is green.
- Unknown/missing manufacturer, track or location information. This is a community catalog, not a guarantee of a complete park inventory.

The first API import can legitimately change many old statuses and identities. An approval bypasses the change-size hold only; it never bypasses failed schema, URL, checksum, app or security checks. If the candidate looks wrong, leave automatic updates off and fix the source or importer before continuing.

## 5. Publish the reviewed bootstrap

Run the same workflow again with **operation: bootstrap** and **publish checked**. Check **approve_large_change** only after reviewing the previous held report. The second run fetches current data, so inspect its report too; it is not a frozen copy of the preview.

A successful publication:

1. Applies the coherent candidate to a temporary checkout, runs all app tests, builds and scans the deployable files.
2. Commits only `catalog.json`, `catalog-manifest.json`, `catalog-data.js` and `catalog-sync/state.json` to `main` using the GitHub Actions bot.
3. Explicitly requests the existing Pages deployment workflow. A bot push alone does not start another push workflow; this extra dispatch handles that [GitHub Actions behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

Wait for **Deploy Tracklist to GitHub Pages** to finish. Check Explore parks, a saved park wish list, Statistics/map and credit logging on your live site. Open the site's `catalog-manifest.json`: it should show `initialized: true` and a recent `lastCheckedAt`. Its checksum refers to the exact `catalog.json` bytes.

## 6. Enable scheduled updates

In **Settings → Secrets and variables → Actions → Variables → New repository variable**, add:

| Name | Value |
| --- | --- |
| `TRACKLIST_CATALOG_AUTO_UPDATE` | `true` |

This is a non-secret on/off switch. The workflow polls at **00:23, 06:23, 12:23 and 18:23 UTC**, then publishes changes that pass validation and the review thresholds. It also publishes successful freshness checks even if ride data did not change. To pause, delete the variable or set it to `false`.

GitHub schedules can be delayed and can be disabled after prolonged repository inactivity; they are not a precise timer. Enable failure notifications under your GitHub account's notification settings, monitor the Actions runs and periodically check the **deployed** manifest. An Explore footer says **updates delayed** after 24 hours without a successful deployed check. Reload an already-open app tab to load a newer bundle. See [GitHub scheduled-workflow rules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## What updates automatically

The official API supplies all statuses of roller coasters, including travelling/standalone records, plus park identities, manufacturer references, available coordinates, historical names, precision-preserving opening dates, available YouTube IDs and track counts/names. Normal updates follow the change feed. Park renames propagate to catalog rides and legacy park wishes still resolve when a name/country match is unambiguous. Source merges retain legacy ride IDs for matching; source deletions remove public search entries. Saved personal credits, order, dates, links and notes are never rewritten by the updater.

The importer uses `view=latest`, validates records and follows deletes/merges. A planned opening date passing does **not** make a ride operating: the source must report the change. New rides become searchable after a successful source refresh and deployment, so coverage depends on source contributors and workflow health. The [provider's change-feed guide](https://developer.coasterpedia.net/docs/changes/) explains cursor behavior. An expired cursor triggers a complete bootstrap automatically.

**Wikidata:** the existing 41 CC0 supplemental records are retained. This first groundwork release does not automatically query Wikidata for new coaster records; a separate, reviewed adapter is still needed to expand that supplement. Coasterpedia is the automated source. A supplement entry is suppressed only for a unique name/park/country match with an agreeing existing RCDB link; its old ID is retained as an alias. Ambiguous matches remain separate.

**RCDB:** the API does not document RCDB IDs. Existing valid, unambiguous links are retained by exact source identity; new entries use **Find on RCDB** until an approved link source is available. No RCDB scraping is enabled. Direct POVs are used where supplied; otherwise YouTube search remains available. History does not yet create distinct installation credits for every past location or rebuild. Missing information can still be entered manually.

**Maps:** Statistics uses current API park coordinates when available, with the existing attributed map bundle as a fallback. The optional `node scripts/update-park-map.cjs` refreshes the Wikidata/Natural Earth fallback after an official catalog bootstrap. It no longer needs or reads a bulk Coasterpedia article cache. Its result is a separate, manually reviewed map update.

## Files and future clients

| File | Purpose | Deployed? |
| --- | --- | --- |
| `catalog.json` | Public, app-specific normalized rides and parks; `schemaVersion: 1` | Yes |
| `catalog-manifest.json` | Schema, version/hash, counts, source attribution, check/change times | Yes |
| `catalog-data.js` | Generated synchronous browser wrapper of the same data | Yes |
| `catalog-sync/state.json` | Maintenance cursor and source redirects; no key | No |
| `scripts/catalog/*` | Provider client, normalization and refresh pipeline | No |
| `test-results/catalog-candidate/` | Ignored staging output and review report | No |

Ride IDs are `cp-<wiki page ID>`. New source-backed park IDs are `cp-park-<wiki page ID>`. `legacyIds` and park aliases retain matching across merges/renames. Existing supplemental IDs stay compatible. Public catalog schema versioning is independent of personal backup schema versioning.

A future iOS client can read the manifest and JSON from the existing Pages base URL, cache a last-good copy, verify the SHA-256 and reject unsupported schemas. Use the manifest's version/hash to revalidate a cached catalog and retry a mismatched CDN response; do not discard a last-good offline copy on a network error. This update adds no iOS application or device sync changes.

## Local maintenance and verification

Use Node 22, as the workflows do. Run from the repository root:

```text
npm ci
npm run catalog:check
npm test
npm run build
npm run security:check
```

For a local provider refresh, supply `COASTERPEDIA_API_KEY` through a private process environment or secret manager; avoid putting its value in shell history. `npm run catalog:refresh -- --bootstrap` stages a full candidate. Normal `npm run catalog:refresh` uses the saved cursor. A held candidate must be reviewed and fetched again with `--approve-large-change`. `node scripts/catalog-files.cjs --apply` applies only a candidate whose report permits publication. Then rerun the checks above and review the diff before committing. Prefer the GitHub workflow if you are unfamiliar with environment-variable handling.

The old `scripts/update-coasterpedia.cjs` command now stops without network access. `scripts/update-catalog.cjs` is also retired so it cannot write an incompatible or misleading snapshot. The offline legacy article parser remains solely for regression fixtures.

## Troubleshooting and rollback

| Symptom | Action |
| --- | --- |
| Workflow absent or scheduled job skipped | Merge/push this branch to `main`; enable Actions; check the switch variable is exactly `true`. Manual previews do not need the switch. |
| Missing key / 401 / 403 | Check the secret name, provider account/email/key status and API terms. The script never prints response bodies or credentials. |
| 429 / provider unavailable | Requests are paced below the default limit and honor bounded retries. Other jobs using the same provider account share its quota. Retry later; do not add accounts to evade limits. The last deployed catalog remains available. |
| Schema, invalid URL or checksum failure | Do not force publication. Inspect the beta API contract and update the adapter/tests. A size approval cannot override this. |
| Large change held | Download and review the artifact; manually rerun with approval only if expected. Scheduled runs cannot self-approve. |
| Fetch succeeded but an app test failed | This is separate from an API rate-limit failure. Publication stays blocked. Fix the named test or app behavior, merge the fix to `main`, then start a new manual workflow run. Large-change approval does not bypass tests. |
| `main` changed during import / push rejected | Rerun against current `main`. The updater never force-pushes or overwrites intervening app commits. |
| Branch protection rejects bot commits | Keep protection intact. Use a local reviewed refresh and a normal PR, or explicitly configure your repository's allowed automation policy. Automatic publishing needs an allowed bot-write path; no bypass is included. |
| Data commit exists, site still old | Check the separate Pages workflow. Rerun it after fixing its error. The next successful scheduled publication also dispatches it. A successful fetch is not proof of a successful deployment. |
| Provider portal unavailable | Keep updates off and retry later. The bundled catalog still works without a key. |

To roll back: turn the switch off, identify a known-good catalog commit, restore **all four catalog/checkpoint files together** in a new commit/PR, and run the checks and Pages deployment again. Do not force-push history. The next refresh should use that restored checkpoint or an explicit bootstrap. Catalog rollback never restores or alters users' private Firebase collections.

No host migration is required. Standard public-repository GitHub runners and your existing Pages/Firebase setup can stay within their free allowances; monitor repository artifact/bandwidth limits and your Firebase usage as the app grows. See [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) and the prior [source strategy](docs/catalog-data-strategy.md).
