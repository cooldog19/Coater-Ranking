const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
fs.mkdirSync(out, {recursive: true});
for (const name of ['index.html','styles.css','features.css','core.js','app.js','favicon.svg','catalog-data.js','catalog.js','migration.js','recovery.js','firebase-config.js','sync-model.js','cloud.js','features.js','CATALOG_LICENSE.md']) {
  fs.copyFileSync(path.join(root, name), path.join(out, name));
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('Built Tracklist in dist/ — ready for static hosting.');
