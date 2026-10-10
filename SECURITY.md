# Public deployment security

The site ships only the explicit static asset list in `scripts/build.cjs`. Each build clears the previous artifact, rejects a symlinked output directory, and excludes development files, database rules, credentials, dependencies and tests. The deployment workflow runs the application tests and credential/path scan before uploading `dist/`.

## Public configuration and private credentials

`firebase-config.js` contains public Firebase Web App identifiers, including the Web API key. A browser needs these values to connect. They are not database passwords and cannot be hidden by GitHub Pages or build environment variables. Never put service-account JSON, private keys, admin credentials, session tokens or unrelated API keys in this repository or website.

Database privacy depends on the **published** rules, Authentication and project settings. API restrictions must exclude unrelated/billable APIs, especially the Generative Language API. Restrict the Web key to the Firebase APIs the app uses: Identity Toolkit, Token Service and Cloud Firestore. Verify sign-in, password reset and saving after changing restrictions. Check quotas and usage; authentication and account-owned writes can still consume the project's shared free quota.

## Database boundary

Publish the checked-in `firestore.rules` to the default database before public release. Rules grant individual document reads only to the matching signed-in UID. Anonymous requests, other accounts, collection listing and unexpected paths are denied. Head/snapshot/chunk writes have schema and size limits. Snapshots and chunks cannot be overwritten, and active snapshots cannot be deleted. Recovery cleanup can delete older snapshots. Older history entries have bounded fields and numeric credit counts; the current snapshot receives full metadata validation. Application reads separately validate revision IDs, chunk counts, content sizes and normalized collection data. Chunk JSON is private opaque text to the rules; the client validates its ride contents.

The app uses HTTPS Google endpoints and the pinned Firebase SDK. Transactions compare the last acknowledged revision, stopping saves that would overwrite another device. Server responses must be acknowledged before a save is reported successful. Local account copies and stale asynchronous results remain separate between accounts. No admin SDK, Analytics or file Storage SDK is loaded.

## Browser boundary

The document's Content Security Policy restricts executable scripts, connections, fonts and frames; inline scripts, objects, form submissions and base URL overrides are disallowed. Inline styles remain allowed for the existing dynamic layout. GitHub Pages cannot set custom response security headers, so this meta policy cannot provide `frame-ancestors` protection against framing. Add response headers on a host that supports them if that protection is required.

User text and recovery metadata are escaped before rendering. Imported HTML is parsed in an inert template; imported scripts, frames and image resources are never attached to the page. POV and RCDB links use allowlisted HTTPS destinations. CSV fields that could execute as spreadsheet formulas receive an apostrophe prefix; JSON preserves original text exactly. Public account errors do not include raw SDK diagnostics or operator configuration instructions.

Account sessions persist until logout. Logging out returns to the guest collection but **retains the account's separate local collection and checkpoints** for offline recovery. Local copies and downloaded backups are not encrypted by this app. On shared computers, export anything needed, log out and clear site data. GitHub Pages repositories under one `github.io` hostname share a browser origin; a custom domain dedicated to this app gives stronger isolation from other sites on that hostname.

## Release checks

1. Publish the current rules and confirm Authentication's authorized production domain. Enable only Email/Password. Enable email enumeration protection and set an appropriate password policy. Test the actual sign-in and reset flow.
2. Review the Web API key's API restrictions, Authentication quotas and usage alerts in the Google/Firebase consoles. Do not rely on an API key as access control. App Check with an appropriate web provider is an additional abuse control; it is not enabled in this app. Enabling enforcement before implementing the client would block valid users. Owner rules alone do not prevent account creation or quota abuse.
3. Test a normal account save and reload on the deployed site, then the same account on a second device. Verify a separate account cannot see the first account's credits. Check the browser console for CSP/network errors, touch ranking, desktop ranking, password reset, offline edits and logout.
4. Run `npm ci`, `npm test`, `npm run build`, `npm run security:check -- --history`, and `npm audit`. Review the artifact and the dependency audit before deployment. These scanners check known patterns; they cannot prove absence of every possible secret or vulnerability.
5. Run the actual rule tests as described below. Never point these tests at a production database.

`node scripts/check-http.cjs` starts its own temporary loopback server, checks public asset responses and verifies that development/private paths return 404. It also makes one unauthenticated, read-only request to the configured production database and expects a permission denial. It does not verify authenticated production access or inspect the API key's console restrictions.

## Rule test setup

The test fixture uses a `demo-` project and a fixed loopback-only endpoint. No production credentials are used. It loads the current rules before every run and tests allowed writes, anonymous/cross-account denial, unexpected paths, malformed records, immutable snapshots, cleanup, legacy metadata, a full history and the maximum chunk count.

With Node 18+ and Java 17+, download the test-only official emulator using `node scripts/download-emulator.cjs`. Its version and integrity check come from the official firebase-tools manifest. Start it in one terminal:

```sh
java -jar test-results/emulator/firestore.jar --host 127.0.0.1 --port 8180 --rules firestore.rules --project_id demo-tracklist-security --single_project_mode true
```

In another terminal, run `npm run test:rules`. Stop the emulator afterwards. Downloaded binaries and test output are ignored and never deployed. The compatible pinned emulator tests rule semantics; it does not verify live production settings or CDN/browser behavior.

References: [Firebase API keys](https://firebase.google.com/docs/projects/api-keys), [rule fields](https://firebase.google.com/docs/firestore/security/rules-fields), [rule testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator), [password authentication](https://firebase.google.com/docs/auth/web/password-auth).
