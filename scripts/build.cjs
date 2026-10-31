const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
// The deployment artifact must never retain files from an earlier build.
if (path.dirname(out) !== root || path.basename(out) !== 'dist') throw new Error('Invalid build directory.');
if (fs.existsSync(out) && fs.lstatSync(out).isSymbolicLink()) throw new Error('Build directory cannot be a symbolic link.');
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
require('./catalog-files.cjs').check(root,path.join(root,'catalog-sync/state.json'));
for(const name of ['catalog.json','catalog-manifest.json'])fs.copyFileSync(path.join(root,name),path.join(out,name));
for (const name of ['index.html','styles.css','features.css','comparison.css','comparison-model.js','comparison.js','social.css','social-model.js','social.js','statistics.css','statistics-model.js','statistics.js','park-map-data.js','MAP_LICENSE.md','core.js','app.js','favicon.svg','catalog-data.js','catalog.js','migration.js','recovery.js','firebase-config.js','sync-model.js','cloud.js','features.js','CATALOG_LICENSE.md']) {
  fs.copyFileSync(path.join(root, name), path.join(out, name));
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('Built Tracklist in dist/ — ready for static hosting.');
