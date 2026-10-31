'use strict';
const crypto=require('node:crypto');
const K=require('../../catalog.js'),C=require('../../core.js');
const LICENCE='https://creativecommons.org/licenses/by-sa/4.0/';
const statuses={operating:'Operating',active:'Operating',defunct:'Defunct',closed:'Closed',dismantled:'Dismantled',demolished:'Demolished',relocated:'Relocated',planned:'Planned',announced:'Announced','under construction':'Under construction','under refurbishment':'Under refurbishment','standing but not operating':'Standing but not operating','in storage':'In storage',sbno:'Standing but not operating',cancelled:'Cancelled',canceled:'Cancelled',unknown:'Unknown'};
function text(v,max=240){if(v===undefined||v===null)return '';if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))throw Error('Invalid text field in provider record.');return v.trim();}
function id(v){if(!Number.isSafeInteger(v)||v<1)throw Error('Invalid provider identity.');return v;}
function refs(v){if(v==null)return [];if(!Array.isArray(v)||v.length>30)throw Error('Invalid provider references.');return v.map(r=>({id:r.id==null?null:id(r.id),name:text(r.name)}));}
function coordinates(v){if(v===undefined||v===null)return null;if(!Number.isFinite(v.lat)||!Number.isFinite(v.lon)||Math.abs(v.lat)>90||Math.abs(v.lon)>180)throw Error('Invalid park coordinates.');return {lat:v.lat,lon:v.lon};}
function date(v){
  if(v===undefined||v===null)return null;
  const edtf=text(v.edtf,80);if(!edtf)throw Error('Missing provider EDTF date.');
  const bound=k=>{if(v[k]===null||v[k]===undefined)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(v[k])||!Number.isFinite(Date.parse(v[k]))||new Date(v[k]).toISOString().slice(0,10)!==v[k])throw Error('Invalid provider date bound.');return v[k];};
  return {edtf,earliest:bound('earliest'),latest:bound('latest')};
}
function dates(v){v=v||{};return Object.fromEntries(['opened','closed','opening','closing'].filter(k=>v[k]).map(k=>[k,date(v[k])]));}
function country(v){return ({US:'United States',GB:'United Kingdom',AE:'United Arab Emirates'}[v?.code]||{USA:'United States',UK:'United Kingdom',UAE:'United Arab Emirates'}[v?.name]||text(v?.name)||text(v?.code,3));}
function base(r){
  const n=id(r.id),revision=id(r.revision),name=text(r.name),title=text(r.title,500);
  if(!name||!title||!Number.isFinite(Date.parse(r.updated_at)))throw Error('Incomplete provider record.');
  return {sourceId:n,name,sourceRevision:revision,sourceUpdatedAt:new Date(r.updated_at).toISOString(),source:`https://coasterpedia.net/w/index.php?title=${encodeURIComponent(title)}&oldid=${revision}`,license:'CC-BY-SA-4.0'};
}
function park(r,old){
  const b=base(r),aliases=[...(r.history?.names||[]).map(n=>text(n.name)),...(old?.aliases||[]),...(old&&old.name!==b.name?[old.name]:[])];
  return {...b,id:`cp-park-${b.sourceId}`,country:country(r.country),countryCode:text(r.country?.code,3),place:text(r.place),state:text(r.state),coordinates:coordinates(r.coordinates),status:status(r.status),dates:dates(r.dates),aliases:[...new Set(aliases)].slice(0,100)};
}
function status(raw){return statuses[text(raw,80).toLowerCase().replace(/[_-]/g,' ')]||'Unknown';}
function ride(r,old,parks){
  if(r.type!=='coaster')return null;
  const b=base(r),location=r.location;if(!location||typeof location!=='object')throw Error('Missing coaster location.');
  const parkRef=location.park,parkId=parkRef?.id===null||parkRef?.id===undefined?null:id(parkRef.id),p=parks.find(p=>p.sourceId===parkId);
  const manufacturerRefs=refs(r.manufacturers),material=r.coaster?.track_material,support=r.coaster?.support_material;
  const type=material==='mixed'||(material==='steel'&&support==='wooden')?'Hybrid':material==='steel'?'Steel':material==='wooden'?'Wooden':'Other';
  const names=r.history?.names||[];if(!Array.isArray(names)||names.length>300)throw Error('Invalid ride name history.');
  const aliases=[...new Set(names.map(n=>text(n.name)).concat(old?.aliases||[],old&&old.name!==b.name?[old.name]:[]))].filter(n=>n&&n!==b.name).slice(0,100);
  const result={...b,id:`cp-${b.sourceId}`,aliases,legacyIds:[...new Set([...(old?.legacyIds||[]),...(r.merged_ids||[]).map(n=>`cp-${id(n)}`)])],park:p?.name||text(parkRef?.name),parkId:p?.id||(parkId?`cp-park-${parkId}`:''),sourceParkId:parkId,parkAliases:p?.aliases||[],country:p?.country||country(location.country),countryCode:p?.countryCode||text(location.country?.code,3),locationKind:text(location.kind,40),coordinates:coordinates(location.coordinates),manufacturer:manufacturerRefs.map(m=>m.name).filter(Boolean).join(' / '),manufacturerRefs,type,status:status(r.status),sourceStatus:text(r.status,80),dates:dates(r.dates),rcdb:'',pov:''};
  if(old?.rcdb){try{result.rcdb=C.rcdbURL(old.rcdb);}catch{}}
  const videos=r.videos||[];if(!Array.isArray(videos)||videos.length>3||videos.some(v=>typeof v!=='string'||!/^[-\w]{11}$/.test(v)))throw Error('Invalid provider video identifier.');
  if(videos[0])result.pov=`https://www.youtube.com/watch?v=${videos[0]}`;
  else if(old?.pov){try{result.pov=C.povURL(old.pov);}catch{}}
  result.categories=(r.categories||[]).map(v=>text(v,120));if(result.categories.length>100)throw Error('Too many ride categories.');
  let count=r.coaster?.tracks?.length||r.stats?.tracks||1;
  if(!Number.isSafeInteger(count)||count<1||count>100)throw Error('Invalid track count.');
  result.trackCount=count;
  if(count>1&&count<=8){
    const family=C.trackFamily(result),specific=r.coaster?.tracks;
    if(specific!=null&&(!Array.isArray(specific)||specific.length!==count))throw Error('Inconsistent provider track data.');
    result.tracks=Array.from({length:count},(_,i)=>({id:`track-${specific?.[i]?.index? id(specific[i].index):i+1}`,name:text(specific?.[i]?.name,80)||family?.tracks?.[i]||`Track ${i+1}`,ridden:false}));
  }
  return result;
}
function validate(catalog){
  const only=(value,allowed)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.split(' ').includes(k)))throw Error('Unsupported field in public catalog.');};
  only(catalog,'schemaVersion version updatedAt source sourceURL license licenseURL coverage rides parks');
  if(catalog.schemaVersion!==1||!Array.isArray(catalog.rides)||!Array.isArray(catalog.parks)||catalog.rides.length>100000||catalog.parks.length>30000)throw Error('Unsupported catalog shape.');
  const seen=new Set();
  for(const r of catalog.rides){
    only(r,'id name aliases park parkId country manufacturer type rcdb pov source status sourceId sourceRevision sourceUpdatedAt license legacyIds sourceParkId parkAliases countryCode locationKind coordinates manufacturerRefs sourceStatus dates trackCount tracks categories');
    if(!/^(?:cp-\d+|rcdb-\d+|wd-Q\d+)$/.test(r.id)||seen.has(r.id)||!text(r.name)||!['Steel','Wooden','Hybrid','Other'].includes(r.type))throw Error('Invalid or duplicate catalog ride.');seen.add(r.id);
    text(r.park);text(r.country);text(r.manufacturer,2000);if(r.rcdb)C.rcdbURL(r.rcdb);if(r.pov)C.povURL(r.pov);
    const u=new URL(r.source);if(u.protocol!=='https:'||u.username||u.password||u.port||!['coasterpedia.net','www.wikidata.org'].includes(u.hostname))throw Error('Unsafe catalog source link.');
    if(r.coordinates){only(r.coordinates,'lat lon');coordinates(r.coordinates);}
    for(const field of ['aliases','parkAliases','categories'])if(r[field]!==undefined){if(!Array.isArray(r[field])||r[field].length>100)throw Error('Invalid catalog labels.');for(const label of r[field])text(label,240);}
    if(r.legacyIds!==undefined&&(!Array.isArray(r.legacyIds)||r.legacyIds.length>1000||r.legacyIds.some(v=>!/^(?:cp-\d+|rcdb-\d+|wd-Q\d+)$/.test(v))))throw Error('Invalid legacy catalog ID.');
    if(r.manufacturerRefs){refs(r.manufacturerRefs);for(const ref of r.manufacturerRefs)only(ref,'id name');}
    if(r.dates){only(r.dates,'opened closed opening closing');for(const value of Object.values(r.dates)){only(value,'edtf earliest latest');date(value);}}
    if(r.tracks&&(r.tracks.length>8||r.tracks.some(t=>t.ridden!==false)))throw Error('Catalog tracks must not contain personal credits.');
    if(r.tracks){C.trackList(r.tracks);for(const track of r.tracks)only(track,'id name ridden');}
    if(['notes','riddenOn','ranked','favoriteTrack','demoRide','email','password'].some(k=>Object.hasOwn(r,k)))throw Error('Personal fields are forbidden in the public catalog.');
  }
  const legacy=new Set();for(const r of catalog.rides)for(const alias of r.legacyIds||[]){if(seen.has(alias)||legacy.has(alias))throw Error('Conflicting legacy catalog identity.');legacy.add(alias);}
  const parkIds=new Set();for(const p of catalog.parks){only(p,'id name country aliases coordinates sourceId sourceRevision sourceUpdatedAt source license countryCode place state status dates');if(!text(p.id)||parkIds.has(p.id)||!text(p.name))throw Error('Invalid catalog park.');parkIds.add(p.id);if(p.coordinates)coordinates(p.coordinates);if(p.source){const u=new URL(p.source);if(u.protocol!=='https:'||u.hostname!=='coasterpedia.net'||u.username||u.password||u.port)throw Error('Unsafe park source.');}}
  return catalog;
}
const json=v=>JSON.stringify(v,null,2)+'\n';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function prepare(previous,rides,parks,{checkedAt=null,initialized=false,mode='legacy',warnings=[]}={}){
  rides.sort((a,b)=>a.id.localeCompare(b.id,'en'));parks.sort((a,b)=>a.id.localeCompare(b.id,'en'));
  const changed=JSON.stringify(previous.rides)!==JSON.stringify(rides)||JSON.stringify(previous.parks)!==JSON.stringify(parks);
  const catalog=validate({schemaVersion:1,version:1,updatedAt:changed&&checkedAt?checkedAt:previous.updatedAt,source:'Coasterpedia and Wikidata',sourceURL:'https://coasterpedia.net/',license:'CC-BY-SA-4.0',licenseURL:LICENCE,coverage:'Community coaster catalog. Coverage may be incomplete; operating status is not live.',rides,parks});
  const encoded=json(catalog),manifest={schemaVersion:1,catalogURL:'catalog.json',sha256:sha(encoded),datasetVersion:sha(encoded).slice(0,16),datasetChangedAt:catalog.updatedAt,lastCheckedAt:checkedAt,initialized,mode,counts:{rides:rides.length,parks:parks.length},sources:[{name:'Coasterpedia contributors',url:'https://coasterpedia.net/',license:'CC-BY-SA-4.0'},{name:'Wikidata contributors',url:'https://www.wikidata.org/',license:'CC0-1.0',refresh:'retained supplement; separate refresh required'}]};
  const bundle='/* Generated public catalog. Coasterpedia contributors CC BY-SA 4.0; Wikidata CC0. See CATALOG_LICENSE.md. */\nglobalThis.TRACKLIST_CATALOG = '+JSON.stringify({...catalog,lastCheckedAt:checkedAt,automated:initialized})+';\n';
  return {catalog,manifest,bundle,encoded,changed,warnings};
}
function review(previous,next){
  const old=new Map(previous.rides.map(r=>[r.id,r])),ids=new Set(next.rides.map(r=>r.id));
  const removed=previous.rides.filter(r=>!ids.has(r.id)).map(r=>({id:r.id,name:r.name,park:r.park}));
  const added=next.rides.filter(r=>!old.has(r.id)).map(r=>({id:r.id,name:r.name,park:r.park,status:r.status}));
  const statuses=next.rides.filter(r=>old.has(r.id)&&old.get(r.id).status!==r.status).map(r=>({id:r.id,from:old.get(r.id).status,to:r.status}));
  const metadataChanges=next.rides.filter(r=>old.has(r.id)).flatMap(r=>{const fields=['name','park','country','manufacturer','rcdb','type','trackCount'].filter(k=>JSON.stringify(old.get(r.id)[k])!==JSON.stringify(r[k]));return fields.length?[{id:r.id,fields,before:Object.fromEntries(fields.map(k=>[k,old.get(r.id)[k]??null])),after:Object.fromEntries(fields.map(k=>[k,r[k]??null]))}]:[];});
  const warnings=[];if(old.size&&removed.length/old.size>0.02)warnings.push('More than 2% of the previous rides were removed.');if(old.size&&statuses.length/old.size>0.10)warnings.push('More than 10% of ride statuses changed.');
  if(previous.parks.length&&next.parks.length<previous.parks.length*0.9)warnings.push('Park count dropped by more than 10%.');
  for(const field of ['manufacturer','country','park','rcdb','type']){const known=r=>field==='type'?r.type&&r.type!=='Other':!!r[field],before=previous.rides.filter(known).length,after=next.rides.filter(known).length;if(before&&after<before*0.9)warnings.push(`Known ${field} coverage dropped by more than 10%.`);}
  if(!next.rides.length)throw Error('Refusing an empty catalog.');
  return {before:old.size,after:next.rides.length,added,removed,statusChanges:statuses,metadataChanges,requiresApproval:warnings.length>0,warnings};
}
module.exports={text,id,refs,coordinates,date,dates,country,base,park,ride,status,validate,prepare,review,json,sha};
