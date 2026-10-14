(function(root){
  'use strict';
  const fold=text=>String(text||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
  const parkFold=name=>fold(name).replace(/^universals?islandsofadventure$/,'islandsofadventure');
  const parkKey=r=>r.parkId||parkFold(r.park);
  function parks(rides,query=''){
    const result=new Map(),q=fold(query);
    for(const r of rides){
      const key=parkKey(r);if(!r.park)continue;
      if(!result.has(key))result.set(key,{id:key,name:r.park,country:r.country,rides:[]});
      result.get(key).rides.push(r);
    }
    return [...result.values()].filter(p=>fold(`${p.name} ${p.country}`).includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
  }
  function same(a,b){const C=root.Tracklist||(typeof require==='function'?require('./core.js'):null);return C.sameRide(a,b)||!!(a.catalogId&&(a.catalogId===b.id||a.catalogId===b.catalogId));}
  function match(ride,rides){
    const C=root.Tracklist||(typeof require==='function'?require('./core.js'):null),family=C.trackFamily(ride);if(family){const record=rides.find(r=>r.rcdb===family.rcdb);if(record)return {match:record,candidates:[record]};}
    if(ride.rcdb){const exact=rides.find(r=>r.rcdb===ride.rcdb);if(exact)return {match:exact,candidates:[exact]};}
    const name=fold(ride.name),park=parkFold(ride.park);
    const candidates=rides.filter(r=>[r.name,...(r.aliases||[])].some(n=>fold(n)===name));
    if(!candidates.length&&name.length>=3)return {match:null,candidates:rides.filter(r=>fold(r.name).includes(name)&&(!park||parkFold(r.park)===park)).slice(0,20)};
    const exact=park?candidates.filter(r=>parkFold(r.park)===park):candidates;
    return {match:exact.length===1?exact[0]:null,candidates:candidates.slice(0,20)};
  }
  function enrich(ride,record){
    if(!record)return ride;
    return {...ride,park:ride.park||record.park,country:ride.country||record.country,manufacturer:ride.manufacturer||record.manufacturer,type:ride.type==='Other'?record.type:ride.type,rcdb:ride.rcdb||record.rcdb,catalogId:record.id,source:record.source};
  }
  function fromRecord(record,core){return core.ride({...record,id:core.uid(),catalogId:record.catalogId||record.id,ranked:false,demoRide:false});}
  const api={fold,parkKey,parks,same,match,enrich,fromRecord};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TracklistCatalog=api;
})(globalThis);
