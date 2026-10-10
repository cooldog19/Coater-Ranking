# Enable Tracklist account sync

Your provided public Web App configuration is already in `firebase-config.js` for project **coasterlist**. It is safe to commit this public client configuration. Never add a service-account key, admin credential, or private key to the site. Tracklist uses Firebase Authentication and Cloud Firestore; it does not initialize Analytics, Storage, or Cloud Functions.

## Firebase Console

1. Open [your Firebase project](https://console.firebase.google.com/project/coasterlist/overview).
2. Go to **Build → Authentication → Get started**. Under **Sign-in method**, enable **Email/Password** (password sign-in, not email-link sign-in).
3. Under **Authentication → Settings → Authorized domains**, add `cooldog19.github.io`. Add `localhost` and `127.0.0.1` if you will test locally. Domains do not include `https://` or `/Coater-Ranking/`.
4. Go to **Build → Firestore Database → Create database**, create the **(default)** database, choose a suitable location, and start in **production mode**. Use Standard edition for this app. Do not use open/test-mode rules.
5. In the Firestore **Rules** tab, paste the complete contents of this repository’s `firestore.rules` and click **Publish**. The rule requires a signed-in user and restricts access to documents under that user’s own UID. It does not allow public collection reads.
6. Keep the project on **Spark** if you want a no-cost plan with no billing account. Check the current [Firebase pricing](https://firebase.google.com/pricing) and quota dashboard. This app does not need the billable services associated with Blaze.

The initial development check received `CONFIGURATION_NOT_FOUND`; after your console changes, the Authentication setup endpoint responded successfully (HTTP 200). The subsequent login denial was traced to published deny-all rules (allow read, write: if false). The owner confirmed publishing the UID-scoped replacement from firestore.rules. Reopen Account and choose Retry account save to reconnect a previously denied listener. Live signed-in access still needs verification with your account. A public config alone does not configure these services. Tracklist reports setup or security-rule errors and keeps the local collection available.

## Publish and use

Push `main` to deploy through the existing GitHub Pages workflow. In Tracklist, open **Account** or the cloud status button, enter your email/password, and choose the **Create account** tab for your first sign-in. Sign in to that same account on your phone. Existing local credits are uploaded to a new empty account. If cloud data already exists, Tracklist offers a conflict review instead of silently replacing it.

Guest and signed-in collections have separate local storage keys. Signing out returns to the guest collection. Each account’s local copy remains stored on that device. On shared computers, export and clear site data when finished; that also clears saved sign-in persistence. Password reset is available in the sign-in dialog.

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

The sync coordinator is tested with a simulated cloud adapter for offline queues, revision conflicts, rapid edits, and account changes. The provided configuration and SDK URLs are checked separately. End-to-end authentication, production security rules, and real cross-device sync must be verified after these console settings are enabled; this workspace has no Firebase admin login and cannot publish your project’s rules.

References: [Web setup](https://firebase.google.com/docs/web/setup), [Email/password authentication](https://firebase.google.com/docs/auth/web/password-auth), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Security rules](https://firebase.google.com/docs/firestore/security/get-started).
