# Enable Tracklist account sync

Public Web App configuration belongs in `firebase-config.js`. It identifies the backend and is visible to visitors by design. Never add a service-account key, admin credential, or private key to the site. Tracklist uses Firebase Authentication and Cloud Firestore; it does not initialize Analytics, Storage, or Cloud Functions. Read [SECURITY.md](SECURITY.md) before public deployment.

## Firebase Console

1. Open the app's project in the [Firebase Console](https://console.firebase.google.com/).
2. Go to **Build → Authentication → Get started**. Under **Sign-in method**, enable **Email/Password** (password sign-in, not email-link sign-in).
3. Under **Authentication → Settings → Authorized domains**, add the website's production hostname. Domains do not include a protocol or path. Authorize local development domains only when needed. If changing the Web App's auth domain, update the allowed frame origin in `index.html`'s Content Security Policy too.
4. Go to **Build → Firestore Database → Create database**, create the **(default)** database, choose a suitable location, and start in **production mode**. Use Standard edition for this app. Do not use open/test-mode rules.
5. In the Firestore **Rules** tab, paste the complete current contents of `firestore.rules` and click **Publish**. Rules require the matching signed-in UID for private collections and friend settings, allow signed-in reads of explicitly shared profiles, limit writes to the app's exact paths and schemas, and protect recovery snapshots. Do not substitute a broad owner wildcard or public read/write rules. Updating the frontend does not publish rules: existing installations must also publish the new Social paths.
6. Keep the project on **Spark** if you want a no-cost plan with no billing account. Check the current [Firebase pricing](https://firebase.google.com/pricing) and quota dashboard. This app does not need the billable services associated with Blaze.

7. Verify Web API key restrictions, password policy, email enumeration protection and quotas using the release checks in [SECURITY.md](SECURITY.md). The client configuration alone does not configure these protections.

Test a signed-in save on the deployed website and load it on a second device. After changing rules, reopen **Account → Retry account save** to reconnect a previously denied listener. The app keeps local editing and backup available when account saving fails.

## Publish and use

Push `main` to deploy through the existing GitHub Pages workflow. In Tracklist, open **Account** or the cloud status button, enter your email/password, and choose the **Create account** tab for your first sign-in. Sign in to that same account on your phone. Existing local credits are uploaded to a new empty account. If cloud data already exists, Tracklist offers a conflict review instead of silently replacing it.

Guest and signed-in collections have separate local storage keys. Signing out returns to the guest collection. Each account’s local copy remains stored on that device. On shared computers, export and clear site data when finished; that also clears saved sign-in persistence. Password reset is available in the sign-in dialog.

New accounts choose a username during signup. Existing accounts choose one in **Social** or **Account → Profile & username**. The explicit sharing checkbox publishes credits, ranking and wish lists to other signed-in users; private notes, ride dates, email and friends are excluded. **Profile settings** controls visibility. Username and friend settings are stored separately from collection backups. Test lookup, friends and hiding with two accounts after publishing the rules. If Social was opened before the new rules were published, use its **Try again** button or reload the page.

## Saving behavior

- Every edit saves to the browser first. A one-second debounce then uploads a cloud revision while signed in and online.
- Cloud saves use a Firestore transaction with a revision comparison. If another device has changed the cloud head, the save stops and asks you to choose **Use cloud**, **Merge both**, or **Use this device**. Download a local backup before resolving if both versions matter.
- Merge preserves the cloud ranking and existing cloud notes; missing local credits are appended. It does not combine conflicting notes or reconstruct two incompatible rankings. Original cloud revisions and local checkpoints remain recovery options.
- Offline edits remain in local storage with a pending marker. On reconnect, a transaction checks whether the cloud changed. Transactions are never treated as successful while offline. Firebase’s memory-only cache is used; no separate Firestore persistent cache is enabled.
- Cloud snapshots are split into small documents so ordinary collections can exceed Firestore’s per-document size limit. The app caps synced payloads at 6 MB, keeping each transaction under the request-size limit. Larger collections remain local and exportable, with an explicit sync error.
- The last 10 cloud revisions are retained. A successful save removes older retained revisions; a failed cleanup may safely leave extras. **Cloud recovery** can restore an earlier revision as a new local edit.
- Local recovery stores up to 10 checkpoints per collection, within a shared 2 MB storage budget. They do not survive clearing site data. JSON exports are the independent backup; CSV exports contain credits, while JSON also includes the wish list.

No hosting migration is needed: GitHub Pages serves the app and Firebase provides its backend. Moving the frontend to Firebase Hosting or another free static host is possible later, but does not by itself improve the saved data. Spark quotas are suitable for modest personal use, not a guarantee of unlimited free operation. Cloud recovery snapshots consume storage and each save uses several document writes.

## Verification limits

Automated tests cover offline queues, revision conflicts, rapid edits and account isolation. Emulator tests exercise the checked-in rules with allowed and denied requests. They cannot inspect the production console or verify that the same rules are published. Complete the live release checks in [SECURITY.md](SECURITY.md) before making the app public.

References: [Web setup](https://firebase.google.com/docs/web/setup), [Email/password authentication](https://firebase.google.com/docs/auth/web/password-auth), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Security rules](https://firebase.google.com/docs/firestore/security/get-started).
