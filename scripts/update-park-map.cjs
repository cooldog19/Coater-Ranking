// Maintenance only: public park coordinates and a public-domain land outline.
const fs=require('node:fs'),path=require('node:path');
const K=require('../catalog.js'),{parse:parseArticle}=require('./update-coasterpedia.cjs');
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
  // The reviewed public article cache is produced by update-coasterpedia.cjs.
  // Use only agreeing ride coordinates as approximate park centers; retain every source revision.
  const cache=path.join(root,'test-results/catalog-cache'),grouped=new Map();
  if(!fs.existsSync(cache))throw Error('Refresh the public Coasterpedia article cache first; existing map is unchanged.');
  const cacheFiles=fs.readdirSync(cache).filter(f=>/^\d+\.json$/.test(f)).sort((a,b)=>parseInt(a)-parseInt(b));
  if(!cacheFiles.length||cacheFiles.some((file,i)=>parseInt(file)!==i)||JSON.parse(fs.readFileSync(path.join(cache,cacheFiles.at(-1)),'utf8')).continue)throw Error('Public article cache is incomplete; existing map is unchanged.');
  const country=value=>({England:'United Kingdom',Scotland:'United Kingdom',Wales:'United Kingdom','Northern Ireland':'United Kingdom'}[value]||value);
  for(const file of cacheFiles){const cached=JSON.parse(fs.readFileSync(path.join(cache,file),'utf8'));
    for(const page of cached.query?.pages||[]){const record=parseArticle(page),text=page.revisions?.[0]?.slots?.main?.content||'';
      const lat=Number(text.match(/\|\s*coord_lat\s*=\s*(-?\d+(?:\.\d+)?)/i)?.[1]),lon=Number(text.match(/\|\s*coord_long\s*=\s*(-?\d+(?:\.\d+)?)/i)?.[1]);
      if(!record||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||(lat===0&&lon===0))continue;
      const nation=country(record.country),key=K.parkKey(record)+'|'+K.fold(nation);if(!grouped.has(key))grouped.set(key,{name:record.park,country:nation,points:[]});grouped.get(key).points.push({lat,lon,source:record.source});
    }
  }
  let added=0;
  for(const [key,park] of grouped){const matches=[...records.values()].filter(p=>country(p.country)===park.country&&[p.name,...p.aliases].some(name=>K.parkKey({park:name})===K.parkKey({park:park.name})));if(matches.length)continue;
    const middle=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};const lat=middle(park.points.map(p=>p.lat)),lon=middle(park.points.map(p=>p.lon));
    if(park.points.some(p=>Math.hypot((p.lon-lon)*Math.cos(lat*Math.PI/180),p.lat-lat)*111>10))continue;
    const id='cp-park-'+key;records.set(id,{id,name:park.name,aliases:[],country:park.country,lat,lon,source:park.points[0].source,sources:[...new Set(park.points.map(p=>p.source))],license:'CC-BY-SA-4.0',approximate:true});added++;
  }
  const data={version:1,updatedAt:new Date().toISOString(),landPath,parks:[...records.values()].sort((a,b)=>a.name.localeCompare(b.name))};
  fs.writeFileSync(path.join(root,'park-map-data.js'),'// Natural Earth public-domain land; Wikidata CC0 and Coasterpedia CC BY-SA 4.0 locations. See MAP_LICENSE.md.\n'+'globalThis.TRACKLIST_PARK_MAP = '+JSON.stringify(data)+';\n');
  console.log('Added '+added+' approximate parks from source-attributed public ride coordinates.');
  console.log('Bundled '+data.parks.length+' park locations and Natural Earth land.');
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
