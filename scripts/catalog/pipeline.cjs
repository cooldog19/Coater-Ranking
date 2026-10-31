'use strict';
const M=require('./model.cjs');
const {ApiError}=require('./api.cjs');
function redirectsToAliases(rides,redirects){
  for(const [from,to] of Object.entries(redirects)){
    let target=to;const seen=new Set([from]);while(redirects[target]){if(seen.has(target))throw Error('Catalog redirect cycle.');seen.add(target);target=redirects[target];}
    const ride=rides.find(r=>r.id===target);if(ride)ride.legacyIds=[...new Set([...(ride.legacyIds||[]),from])].sort();
  }
}
function cleanDuplicateLinks(rides,warnings){
  const groups=new Map();for(const r of rides){if(!r.rcdb)continue;if(!groups.has(r.rcdb))groups.set(r.rcdb,[]);groups.get(r.rcdb).push(r);}
  for(const group of groups.values())if(group.length>1){warnings.push(`Ambiguous RCDB link removed from ${group.map(r=>r.id).join(', ')}; private credits are unchanged.`);for(const r of group)r.rcdb='';}
}
async function refresh({api,previous,state,bootstrap=false,now=()=>new Date().toISOString()}){
  const startedAt=now(),warnings=[],old=new Map(previous.rides.map(r=>[r.id,r])),redirects={...(state.redirects||{})};
  let rides=previous.rides.filter(r=>r.id.startsWith('cp-')).map(r=>structuredClone(r)),parks=previous.parks.filter(p=>p.sourceId).map(p=>structuredClone(p));
  const supplemental=previous.rides.filter(r=>!r.id.startsWith('cp-')).map(r=>structuredClone(r));
  let mode=bootstrap||!state.initialized?'bootstrap':'incremental',delta;
  if(mode==='incremental'){
    try{delta=await api.changes(state.cursor);}
    catch(error){if(error instanceof ApiError&&error.status===410){mode='bootstrap';warnings.push('Expired change cursor; a complete bootstrap was performed.');}else throw error;}
  }
  if(mode==='bootstrap'){
    const parkIds=await api.list('parks'),parkBatch=await api.records('parks',parkIds);
    parks=parkBatch.records.map(r=>M.park(r,parks.find(p=>p.sourceId===r.id)));
    const rideIds=await api.list('attractions'),rideBatch=await api.records('attractions',rideIds);
    rides=rideBatch.records.map(r=>M.ride(r,old.get(`cp-${r.id}`),parks)).filter(Boolean);
    for(const [from,to] of Object.entries(rideBatch.merged))redirects[`cp-${from}`]=`cp-${to}`;
    // Replay edits made during enumeration before committing a cursor.
    delta=await api.changes(startedAt);
  }
  const latest=new Map();for(const c of delta.changes)latest.set(`${c.kind}:${c.id}`,c);
  function applyRides(batch){
    const removed=new Set([...batch.missing,...Object.keys(batch.merged).map(Number)]);rides=rides.filter(r=>!removed.has(r.sourceId));
    for(const [from,to] of Object.entries(batch.merged))redirects[`cp-${from}`]=`cp-${to}`;
    for(const raw of batch.records){const record=M.ride(raw,rides.find(r=>r.sourceId===raw.id)||old.get(`cp-${raw.id}`),parks);rides=rides.filter(r=>r.sourceId!==raw.id);if(record)rides.push(record);}
  }
  for(const kind of ['park','manufacturer','attraction']){
    const changes=[...latest.values()].filter(c=>c.kind===kind),deletions=new Set(changes.filter(c=>c.op==='delete').map(c=>c.id));
    const wanted=new Set(changes.filter(c=>c.op==='upsert').map(c=>c.id));
    for(const c of changes)if(c.merged_into){wanted.add(c.merged_into);if(kind==='attraction')redirects[`cp-${c.id}`]=`cp-${c.merged_into}`;}
    if(kind==='manufacturer'){
      // Only attractions and parks support bulk ids=. Refresh references through
      // their owning attractions instead of calling an unsupported maker bulk API.
      const makerIds=new Set(changes.map(c=>c.id)),affected=rides.filter(r=>(r.manufacturerRefs||[]).some(m=>makerIds.has(m.id))).map(r=>r.sourceId);
      if(affected.length)applyRides(await api.records('attractions',affected));
      continue;
    }
    const previousParks=parks;
    if(kind==='park')parks=parks.filter(p=>!deletions.has(p.sourceId));
    if(kind==='attraction')rides=rides.filter(r=>!deletions.has(r.sourceId));
    if(!wanted.size)continue;
    const endpoint={park:'parks',attraction:'attractions'}[kind];
    const batch=await api.records(endpoint,[...wanted]);
    if(kind==='park'){
      const removed=new Set([...deletions,...batch.missing,...Object.keys(batch.merged).map(Number)]);
      parks=parks.filter(p=>!removed.has(p.sourceId));
      for(const raw of batch.records){const p=M.park(raw,parks.find(p=>p.sourceId===raw.id));parks=parks.filter(x=>x.sourceId!==raw.id);parks.push(p);}
      const merges=batch.merged;
      for(const c of changes)if(c.merged_into)merges[c.id]=c.merged_into;
      for(const [from,to] of Object.entries(merges)){const prior=previousParks.find(p=>p.sourceId===Number(from)),target=parks.find(p=>p.sourceId===to);if(prior&&target)target.aliases=[...new Set([...target.aliases,prior.name,...(prior.aliases||[])])];}
      for(const r of rides)if(merges[r.sourceParkId])r.sourceParkId=merges[r.sourceParkId];
    }else{
      applyRides(batch);
    }
  }
  // A park edit must reach its rides even if none of their own pages changed.
  const parkMap=new Map(parks.map(p=>[p.sourceId,p]));
  for(const r of rides){const p=parkMap.get(r.sourceParkId);if(!p)continue;r.park=p.name;r.parkId=p.id;r.parkAliases=p.aliases;r.country=p.country;r.countryCode=p.countryCode;}
  redirectsToAliases(rides,redirects);
  // Retain the attributed CC0 supplement; do not guess merges across sources.
  // Suppress only unique name + park + country matches with an agreeing direct
  // RCDB link already present. Preserve the old supplement ID as a matching alias.
  const key=r=>[r.name,r.park,r.country].map(v=>require('../../catalog.js').fold(v)).join('|'),counts=items=>items.reduce((m,r)=>m.set(key(r),(m.get(key(r))||0)+1),new Map()),cpKeys=counts(rides),supplementKeys=counts(supplemental);
  const retained=supplemental.filter(r=>{if(cpKeys.get(key(r))!==1||supplementKeys.get(key(r))!==1)return true;const primary=rides.find(p=>key(p)===key(r));if(!primary.rcdb||primary.rcdb!==r.rcdb){warnings.push(`${r.id} has an unresolved cross-source name match; both records are retained.`);return true;}primary.legacyIds=[...new Set([...(primary.legacyIds||[]),r.id])];return false;});
  rides.push(...retained);
  const referenced=new Set(rides.map(r=>r.parkId));
  const retainedParks=previous.parks.filter(p=>!p.sourceId&&referenced.has(p.id));
  parks.push(...retainedParks.filter(p=>!parks.some(x=>x.id===p.id)));
  cleanDuplicateLinks(rides,warnings);
  for(const r of rides)if(r.trackCount>8)warnings.push(`${r.id} has ${r.trackCount} tracks; manual track review is needed (the app supports eight).`);
  for(const r of rides)if(r.status==='Unknown'&&r.sourceStatus&&r.sourceStatus!=='unknown')warnings.push(`${r.id} has an unrecognized source status; it remains Unknown.`);
  const prepared=M.prepare(previous,rides,parks,{checkedAt:now(),initialized:true,mode,warnings});
  const report={...M.review(previous,prepared.catalog),mode,checkedAt:prepared.manifest.lastCheckedAt,providerChanges:delta.changes.length,normalizationWarnings:warnings};
  return {...prepared,report,state:{schemaVersion:1,initialized:true,view:'latest',cursor:delta.cursor,lastSuccessfulAt:prepared.manifest.lastCheckedAt,redirects}};
}
module.exports={refresh,redirectsToAliases,cleanDuplicateLinks};
