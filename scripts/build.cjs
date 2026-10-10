const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
fs.mkdirSync(out, {recursive: true});
for (const name of ['index.html', 'styles.css', 'core.js', 'app.js', 'favicon.svg']) {
  fs.copyFileSync(path.join(root, name), path.join(out, name));
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('Built Tracklist in dist/ — ready for static hosting.');
