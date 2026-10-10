// Refresh the shipped CC0 catalog. A refresh is a maintenance task, not a visitor API call.
const fs = require('node:fs');
const path = require('node:path');
const query = `SELECT ?item ?itemLabel ?park ?parkLabel ?countryLabel ?makerLabel ?kindLabel ?rcdb ?closed WHERE {
  ?item wdt:P2751 ?rcdb .
  ?item wdt:P31/wdt:P279* wd:Q204832 .
  OPTIONAL { ?item (wdt:P361|wdt:P131|wdt:P276) ?park . ?park wdt:P31/wdt:P279* wd:Q194195 . OPTIONAL { ?park wdt:P17 ?country . } }
  OPTIONAL { ?item wdt:P17 ?country . }
  OPTIONAL { ?item wdt:P176 ?maker . }
  OPTIONAL { ?item wdt:P31 ?kind . }
  OPTIONAL { ?item wdt:P576 ?closed . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}`;
async function run() {
  const response = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query), {
    headers: {'Accept':'application/sparql-results+json','User-Agent':'Tracklist/1.1 (open coaster catalog; github.com/cooldog19/Coater-Ranking)'},
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Wikidata responded with ${response.status}; existing catalog is unchanged.`);
  const data = await response.json();
  const records = new Map();
  const value = (row,key) => row[key]?.value || '';
  const label = text => /^Q\d+$/.test(text) ? '' : text;
  for (const row of data.results.bindings) {
    const rcdb = value(row,'rcdb');
    if (!/^\d+$/.test(rcdb)) continue;
    const id = `rcdb-${rcdb}`, name = label(value(row,'itemLabel'));
    if (!name) continue;
    let record = records.get(id);
    if (!record) {
      record = {id,name,park:label(value(row,'parkLabel')),parkId:value(row,'park').split('/').pop() || '',country:label(value(row,'countryLabel')),manufacturer:label(value(row,'makerLabel')),type:'Other',rcdb:`https://rcdb.com/${rcdb}.htm`,source:value(row,'item').replace(/^http:/,'https:'),status:value(row,'closed')?'Defunct':'Unknown',kinds:[]};
      records.set(id,record);
    }
    const kind = label(value(row,'kindLabel'));
    if (kind && !record.kinds.includes(kind)) record.kinds.push(kind);
    if (!record.park) {record.park=label(value(row,'parkLabel'));record.parkId=value(row,'park').split('/').pop()||'';}
    if (!record.country) record.country=label(value(row,'countryLabel'));
    if (!record.manufacturer) record.manufacturer=label(value(row,'makerLabel'));
  }
  const rides = [...records.values()].filter(r=>r.park).map(r=>{
    const kinds=r.kinds.join(' ').toLowerCase();
    r.type=kinds.includes('hybrid')?'Hybrid':kinds.includes('wooden')?'Wooden':kinds.includes('steel')?'Steel':'Other';
    delete r.kinds;return r;
  }).sort((a,b)=>a.park.localeCompare(b.park)||a.name.localeCompare(b.name));
  if (rides.length < 100) throw new Error('Catalog response is unexpectedly small; existing catalog is unchanged.');
  const catalog = {version:1,updatedAt:new Date().toISOString(),source:'Wikidata',sourceURL:'https://www.wikidata.org/',license:'CC0-1.0',licenseURL:'https://creativecommons.org/publicdomain/zero/1.0/',coverage:'Wikidata entries with an RCDB identifier and a named park. Coverage and operating status are incomplete.',rides};
  const cache=path.resolve(__dirname,'../test-results');fs.mkdirSync(cache,{recursive:true});
  fs.writeFileSync(path.join(cache,'wikidata-supplement.json'),JSON.stringify(catalog));
  console.log(`Cached ${rides.length.toLocaleString()} Wikidata rides. Run scripts/update-coasterpedia.cjs to rebuild the combined catalog.`);
  for (const name of ['Cedar Point','Kings Island','Carowinds']) console.log(name, rides.filter(r=>r.park===name).map(r=>r.name).join(', '));
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
