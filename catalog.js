(function(root){
  'use strict';
  const fold=text=>String(text||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
  const parkFold=name=>fold(name).replace(/^universals?islandsofadventure$/,'islandsofadventure');
  const parkKey=r=>r.parkId||parkFold(r.park);
  function parks(rides,query='',parkRecords=[]){
    const result=new Map(),q=fold(query);
    for(const p of parkRecords)result.set(p.id,{...p,rides:[]});
    for(const r of rides){
      const key=parkKey(r);if(!r.park)continue;
      if(!result.has(key))result.set(key,{id:key,name:r.park,country:r.country,rides:[]});
      result.get(key).rides.push(r);
    }
    return [...result.values()].filter(p=>fold(`${p.name} ${p.country}`).includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
  }
  function same(a,b){const C=root.Tracklist||(typeof require==='function'?require('./core.js'):null),aid=a.catalogId||(/^(cp-|rcdb-|wd-Q)/.test(a.id)?a.id:''),bid=b.catalogId||(/^(cp-|rcdb-|wd-Q)/.test(b.id)?b.id:'');if(aid&&bid)return aid===bid||(b.legacyIds||[]).includes(aid)||(a.legacyIds||[]).includes(bid)||!!(C.trackFamily(a)&&C.trackFamily(a)?.id===C.trackFamily(b)?.id);return C.sameRide(a,b);}
  function findPark(saved,parks){const exact=parks.find(p=>p.id===saved.id);if(exact)return exact;const candidates=parks.filter(p=>[p.name,...(p.aliases||[])].some(n=>parkFold(n)===parkFold(saved.name))&&(!saved.country||fold(saved.country)===fold(p.country)));return candidates.length===1?candidates[0]:null;}
  function freshness(data,now=Date.now()){const checked=Date.parse(data.lastCheckedAt);if(data.automated&&Number.isFinite(checked))return `Checked ${new Date(checked).toLocaleDateString()}${now-checked>86400000?' · updates delayed':''}`;return `Snapshot ${new Date(data.updatedAt).toLocaleDateString()}`;}
  function match(ride,rides){
    if(ride.catalogId){const matches=rides.filter(r=>r.id===ride.catalogId||(r.legacyIds||[]).includes(ride.catalogId));if(matches.length===1)return {match:matches[0],candidates:matches};}
    const C=root.Tracklist||(typeof require==='function'?require('./core.js'):null),family=C.trackFamily(ride);if(family){const matches=rides.filter(r=>r.rcdb===family.rcdb);if(matches.length===1)return {match:matches[0],candidates:matches};}
    if(ride.rcdb){const matches=rides.filter(r=>r.rcdb===ride.rcdb);if(matches.length===1)return {match:matches[0],candidates:matches};}
    const name=fold(ride.name),park=parkFold(ride.park);
    const candidates=rides.filter(r=>[r.name,...(r.aliases||[])].some(n=>fold(n)===name));
    if(!candidates.length&&name.length>=3)return {match:null,candidates:rides.filter(r=>fold(r.name).includes(name)&&(!park||parkFold(r.park)===park)).slice(0,20)};
    const exact=(park?candidates.filter(r=>[r.park,...(r.parkAliases||[])].some(p=>parkFold(p)===park)):candidates).filter(r=>!ride.country||!r.country||fold(ride.country)===fold(r.country));
    return {match:exact.length===1?exact[0]:null,candidates:candidates.slice(0,20)};
  }
  function enrich(ride,record){
    if(!record)return ride;
    return {...ride,park:ride.park||record.park,country:ride.country||record.country,manufacturer:ride.manufacturer||record.manufacturer,type:ride.type==='Other'?record.type:ride.type,rcdb:ride.rcdb||record.rcdb,catalogId:record.id,source:record.source};
  }
  function fromRecord(record,core){return core.ride({...record,id:core.uid(),catalogId:record.catalogId||record.id,ranked:false,demoRide:false});}
  const api={fold,parkKey,parks,findPark,freshness,same,match,enrich,fromRecord};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TracklistCatalog=api;
})(globalThis);
