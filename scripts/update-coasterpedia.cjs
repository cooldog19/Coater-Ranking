// Read public wiki articles through the documented MediaWiki API (no Cargo SQL queries).
// The derived catalog is distributed under CC BY-SA 4.0 with a per-record source revision.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const endpoint='https://coasterpedia.net/w/api.php';
const cacheDir=path.resolve(__dirname,'../test-results/catalog-cache');
const clean=value=>String(value||'').replace(/<!--[^]*?-->/g,'').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g,'$2').replace(/\[\[([^\]]+)\]\]/g,'$1').replace(/<br\s*\/?\s*>/gi,' / ').replace(/<[^>]*>/g,'').replace(/'{2,}/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
function parse(page){
  const text=page.revisions?.[0]?.slots?.main?.content||'';
  const start=text.search(/\{\{Infobox roller coaster\b/i);if(start<0)return null;
  let depth=0,end=text.length;
  for(let i=start;i<text.length-1;i++){const pair=text.slice(i,i+2);if(pair==='{{'){depth++;i++;}else if(pair==='}}'){depth--;i++;if(!depth){end=i+1;break;}}}
  const box=text.slice(start+2,end-2),fields={},segments=[];let nested=0,links=0,last=0;
  for(let i=0;i<box.length;i++){
    const pair=box.slice(i,i+2);
    if(pair==='{{'){nested++;i++;}else if(pair==='}}'){nested--;i++;}
    else if(pair==='[['){links++;i++;}else if(pair===']]'){links--;i++;}
    else if(box[i]==='|'&&!nested&&!links){segments.push(box.slice(last,i));last=i+1;}
  }
  segments.push(box.slice(last));
  for(const segment of segments){const match=segment.match(/^\s*([^=\n]+?)\s*=\s*([^]*)$/);if(match)fields[match[1].toLowerCase().trim()]=clean(match[2]);}
  if(!fields.park)return null;
  const country={USA:'United States',UK:'United Kingdom'}[fields.country]||fields.country||'';
  const rcdbTemplate=text.match(/\{\{RCDB\b[^}]*\}\}/i)?.[0]||'';
  const rcdbId=rcdbTemplate.match(/rcdb\.com\/(\d+)\.htm/i)?.[1]||(/^\d+$/.test(fields.rcdb||'')?fields.rcdb:'');
  const categories=[fields.category1,fields.category2,fields.category3,fields.category4].join(' ').toLowerCase();
  const status=fields.status?.toLowerCase();
  const statuses={operating:'Operating',closed:'Closed',sbno:'Standing but not operating',defunct:'Defunct',relocated:'Relocated',construction:'Under construction',planned:'Planned',removed:'Defunct'};
  const currentName=Object.keys(fields).filter(k=>/^name\d+$/.test(k)&&/present|current/i.test(fields[k+'to']||'')).sort((a,b)=>Number(b.slice(4))-Number(a.slice(4)))[0];
  const name=fields[currentName||'name']&&!fields[currentName||'name'].includes('{{')?fields[currentName||'name']:page.title.replace(/\s*\([^)]*\)\s*$/,'');
  const aliases=[...new Set(Object.keys(fields).filter(k=>/^name\d*$/.test(k)).map(k=>fields[k]).filter(n=>n&&n!==name&&!n.includes('{{')))];
  const video=fields[currentName?.replace('name','video')]||fields.video;
  return {id:`cp-${page.pageid}`,name,aliases,park:fields.park,parkId:'',country,manufacturer:fields.manufacturer||'',type:categories.includes('hybrid')?'Hybrid':categories.includes('wood')?'Wooden':categories.includes('steel')?'Steel':'Other',rcdb:rcdbId?`https://rcdb.com/${rcdbId}.htm`:'',pov:/^[\w-]{11}$/.test(video||'')?`https://www.youtube.com/watch?v=${video}`:'',source:`https://coasterpedia.net/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${page.revisions[0].revid}`,status:statuses[status]||'Unknown'};
}
async function request(params){
  const url=new URL(endpoint);for(const [k,v]of Object.entries({action:'query',format:'json',formatversion:'2',...params}))url.searchParams.set(k,v);
  const response=await fetch(url,{headers:{'User-Agent':'Tracklist/1.1 (public CC BY-SA catalog; github.com/cooldog19/Coater-Ranking)'},signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error(`Public wiki API returned HTTP ${response.status}.`);
  const data=await response.json();if(data.error)throw new Error(data.error.info);return data;
}
async function run(){
  fs.mkdirSync(cacheDir,{recursive:true});let continuation={},batch=0;const records=[];
  do{
    const file=path.join(cacheDir,`${batch}.json`);
    const data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):await request({generator:'embeddedin',geititle:'Template:Infobox roller coaster',geilimit:'50',geinamespace:'0',prop:'revisions',rvprop:'ids|content',rvslots:'main',...continuation});
    if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify(data));
    for(const page of data.query?.pages||[]){const record=parse(page);if(record)records.push(record);}
    continuation=data.continue||null;batch++;
    if(batch%10===0)console.log(`Catalog: ${records.length.toLocaleString()} park rides read (${batch} batches).`);
    if(continuation)await new Promise(resolve=>setTimeout(resolve,200));
  }while(continuation);
  if(records.length<1000)throw new Error('Public catalog response too small; shipped catalog unchanged.');
  const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../catalog-data.js'),'utf8'),context);
  const known=new Set(records.map(r=>r.rcdb).filter(Boolean));
  const supplement=path.resolve(__dirname,'../test-results/wikidata-supplement.json');
  const wd=fs.existsSync(supplement)?JSON.parse(fs.readFileSync(supplement,'utf8')).rides:(context.TRACKLIST_CATALOG?.rides||[]).filter(r=>/^https?:\/\/www.wikidata.org\//.test(r.source));
  const key=r=>`${r.name.toLowerCase()}|${r.park.toLowerCase()}`;
  const names=new Set(records.map(key));
  for(const r of wd){const existing=r.rcdb&&records.find(c=>c.rcdb===r.rcdb);if(existing){if(r.name!==existing.name)existing.aliases=[...new Set([...(existing.aliases||[]),r.name])];}else if(!names.has(key(r))){records.push({...r,parkId:''});names.add(key(r));if(r.rcdb)known.add(r.rcdb);}}
  records.sort((a,b)=>a.park.localeCompare(b.park)||a.name.localeCompare(b.name));
  const catalog={version:1,updatedAt:new Date().toISOString(),source:'Coasterpedia and Wikidata',sourceURL:'https://coasterpedia.net/',license:'CC-BY-SA-4.0',licenseURL:'https://creativecommons.org/licenses/by-sa/4.0/',coverage:'Park-based roller coaster articles from Coasterpedia, supplemented by Wikidata. This community catalog includes historic rides and may miss new or lesser-documented rides. Operating status is not live.',rides:records};
  fs.writeFileSync(path.resolve(__dirname,'../catalog-data.js'),`/* Catalog: Coasterpedia contributors, CC BY-SA 4.0; supplemental Wikidata records, CC0. See CATALOG_LICENSE.md. */\nglobalThis.TRACKLIST_CATALOG = ${JSON.stringify(catalog)};\n`);
  console.log(`Saved ${records.length.toLocaleString()} rides across ${new Set(records.map(r=>r.park)).size.toLocaleString()} parks.`);
}
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={parse};
