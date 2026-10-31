// Maintenance only: public park coordinates and a public-domain land outline.
const fs=require('node:fs'),path=require('node:path');
const K=require('../catalog.js');
const root=path.resolve(__dirname,'..');
const landURL='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';
const query=`SELECT DISTINCT ?park ?name ?alias ?country ?coord WHERE {
  ?park wdt:P31/wdt:P279* wd:Q194195; wdt:P625 ?coord; rdfs:label ?name.
  FILTER(LANG(?name) = "en")
  OPTIONAL { ?park skos:altLabel ?alias. FILTER(LANG(?alias) = "en") }
  OPTIONAL { ?park wdt:P17 ?nation. ?nation rdfs:label ?country. FILTER(LANG(?country) = "en") }
}`;
async function json(url){const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Tracklist park map (public data maintenance)'},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Map source responded with '+r.status);return r.json();}
async function run(){
  const [land,result]=await Promise.all([json(landURL),json('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(query))]);
  let landPath='';const n=x=>Number(x.toFixed(2));
  const ring=points=>{if(points.length<3)return;landPath+='M'+points.map(([lon,lat])=>`${n((lon+180)*4)},${n((90-lat)*4)}`).join('L')+'Z';};
  for(const feature of land.features){const g=feature.geometry;if(g.type==='Polygon')g.coordinates.forEach(ring);if(g.type==='MultiPolygon')g.coordinates.forEach(p=>p.forEach(ring));}
  const records=new Map();
  for(const row of result.results.bindings){const id=row.park.value.split('/').pop(),match=/^Point\((-?[\d.]+) (-?[\d.]+)\)$/.exec(row.coord.value);if(!match)continue;
    const lon=Number(match[1]),lat=Number(match[2]);if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
    if(!records.has(id))records.set(id,{id,name:row.name.value,aliases:[],country:row.country?.value||'',lat:Number(lat.toFixed(6)),lon:Number(lon.toFixed(6)),source:'https://www.wikidata.org/wiki/'+id});
    const r=records.get(id),alias=row.alias?.value;if(alias&&!r.aliases.includes(alias))r.aliases.push(alias);
  }
  if(records.size<500||landPath.length<10000)throw Error('Map response is incomplete; existing map data is unchanged.');
  // Source-approved API park coordinates, already checked by the catalog pipeline.
  const {catalog,manifest}=require('./catalog-files.cjs').check(root,path.join(root,'catalog-sync/state.json'));
  if(!manifest.initialized)throw Error('Bootstrap the official catalog first. Existing map data is unchanged.');
  let added=0;
  for(const park of catalog.parks){
    if(!park.coordinates||!park.sourceId)continue;
    const matches=[...records.values()].filter(p=>K.fold(p.country)===K.fold(park.country)&&[p.name,...p.aliases].some(n=>K.fold(n)===K.fold(park.name)));
    if(matches.length)continue;
    records.set(park.id,{id:park.id,name:park.name,aliases:park.aliases||[],country:park.country,...park.coordinates,source:park.source,license:'CC-BY-SA-4.0'});added++;
  }
  const data={version:1,updatedAt:new Date().toISOString(),landPath,parks:[...records.values()].sort((a,b)=>a.name.localeCompare(b.name))};
  fs.writeFileSync(path.join(root,'park-map-data.js'),'// Natural Earth public-domain land; Wikidata CC0 and Coasterpedia CC BY-SA 4.0 locations. See MAP_LICENSE.md.\n'+'globalThis.TRACKLIST_PARK_MAP = '+JSON.stringify(data)+';\n');
  console.log('Added '+added+' parks from the official catalog.');
  console.log('Bundled '+data.parks.length+' park locations and Natural Earth land.');
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
