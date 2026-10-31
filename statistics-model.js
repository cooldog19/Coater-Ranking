(function(root){
  'use strict';
  const C=root.Tracklist||(typeof require==='function'?require('./core.js'):null);
  const K=root.TracklistCatalog||(typeof require==='function'?require('./catalog.js'):null);
  const fold=K.fold;
  const manufacturerAliases=new Map([
    ['bollandmabillard','Bolliger & Mabillard'],['bolligerandmabillard','Bolliger & Mabillard'],['bandm','Bolliger & Mabillard'],['bm','Bolliger & Mabillard'],
    ['rmc','Rocky Mountain Construction'],['rockymountainconstruction','Rocky Mountain Construction'],['gci','Great Coasters International'],['greatcoastersinternational','Great Coasters International'],
    ['vekoma','Vekoma'],['intamin','Intamin'],['intaminamusementrides','Intamin'],['mack','Mack Rides'],['mackrides','Mack Rides'],['gerstlauer','Gerstlauer'],['gerstlaueramusementrides','Gerstlauer']
  ]);
  const unknown=value=>!value||['unknown','other','notlisted','notspecified','na'].includes(fold(value));
  const countryNames=new Map([['usa','United States'],['us','United States'],['unitedstatesofamerica','United States'],['uk','United Kingdom'],['greatbritain','United Kingdom'],['england','United Kingdom'],['scotland','United Kingdom'],['wales','United Kingdom'],['northernireland','United Kingdom']]);
  function catalogLocations(){const official=(root.TRACKLIST_CATALOG?.parks||[]).filter(p=>p.coordinates).map(p=>({...p,lat:p.coordinates.lat,lon:p.coordinates.lon})),keys=new Set(official.map(p=>fold(p.name)+'|'+fold(p.country)));return official.concat((root.TRACKLIST_PARK_MAP?.parks||[]).filter(p=>!keys.has(fold(p.name)+'|'+fold(p.country))));}
  function analyze(state,catalog=root.TRACKLIST_CATALOG?.rides||[],locations=catalogLocations()){
    const clean=C.normalize(state),byId=new Map(catalog.map(r=>[r.id,r])),byRCDB=new Map();
    for(const r of catalog){for(const legacy of r.legacyIds||[])if(!byId.has(legacy))byId.set(legacy,r);if(r.rcdb)byRCDB.set(r.rcdb,byRCDB.has(r.rcdb)?null:r);}
    const locById=new Map(locations.map(p=>[p.id,p])),locByName=new Map();
    for(const p of locations)for(const label of [p.name,...(p.aliases||[])]){const key=K.parkKey({park:label});if(!locByName.has(key))locByName.set(key,[]);if(!locByName.get(key).some(r=>r.id===p.id))locByName.get(key).push(p);}
    function placeFor(name,country,parkId){let place=locById.get(parkId);if(!place){let matches=locByName.get(K.parkKey({park:name}))||[];if(country){const exact=matches.filter(p=>fold(p.country)===fold(country));matches=exact.length?exact:matches.filter(p=>!p.country);}if(matches.length===1)place=matches[0];}
      return place&&Number.isFinite(place.lat)&&Number.isFinite(place.lon)&&Math.abs(place.lat)<=90&&Math.abs(place.lon)<=180?place:null;}
    const byName=new Map();for(const r of catalog){for(const name of [r.name,...(r.aliases||[])]){const key=fold(name)+'|'+K.parkKey({park:r.park});if(!byName.has(key))byName.set(key,[]);byName.get(key).push(r);}}
    function enrich(r){const matches=byName.get(fold(r.name)+'|'+K.parkKey({park:r.park}));const record=byId.get(r.catalogId)||byRCDB.get(r.rcdb)||(matches?.length===1?matches[0]:null);
      const manufacturer=r.manufacturer||record?.manufacturer||'',type=r.type==='Other'?(record?.type||'Other'):r.type;
      const park=r.park||record?.park||'',rawCountry=r.country||record?.country||'',country=countryNames.get(fold(rawCountry))||rawCountry,place=placeFor(park,country,record?.parkId);
      return {...r,manufacturer:manufacturerAliases.get(fold(manufacturer))||manufacturer,type,country:country||place?.country||'',park,parkId:record?.parkId||'',mapPlace:place};
    }
    const rides=clean.rides.filter(r=>!r.demoRide).map(enrich),wishes=clean.wishlist.map(enrich),ranked=rides.filter(r=>r.ranked),ranks=new Map(ranked.map((r,i)=>[r.id,i+1]));
    const credits=C.creditCount(rides);
    const rankScore=rank=>ranked.length<2?100:100*(ranked.length-rank)/(ranked.length-1);
    function groups(field){const map=new Map();
      const add=(r,wish)=>{const label=field==='park'?(r.park||'Park not listed'):unknown(r[field])?'Not listed':r[field];const key=field==='park'?(r.mapPlace?.id||K.parkKey({park:label}))+'|'+fold(r.country):fold(label);
        if(!map.has(key))map.set(key,{key,name:label,country:field==='park'?r.country:'',known:field==='park'?!!r.park:label!=='Not listed',credits:0,ranked:0,top10:0,wishes:0,sumRank:0,sumScore:0,rides:[],...(field==='park'&&r.mapPlace?{location:{lat:r.mapPlace.lat,lon:r.mapPlace.lon,source:r.mapPlace.source}}:{})});
        const row=map.get(key);if(wish){row.wishes++;return;}row.credits+=C.creditValue(r);row.rides.push(r);const rank=ranks.get(r.id);if(rank){row.ranked++;row.sumRank+=rank;row.sumScore+=rankScore(rank);if(rank<=10)row.top10++;}
      };
      rides.forEach(r=>add(r,false));wishes.forEach(r=>add(r,true));
      return [...map.values()].map(r=>({...r,averageRank:r.ranked?r.sumRank/r.ranked:null,score:r.ranked?r.sumScore/r.ranked:null,share:credits?100*r.credits/credits:0}));
    }
    const manufacturers=groups('manufacturer'),types=groups('type'),parks=groups('park'),countries=groups('country');
    function favorite(rows){const known=rows.filter(r=>r.known&&r.ranked),minimum=Math.min(3,ranked.length),supported=known.filter(r=>r.ranked>=minimum);return [...(supported.length?supported:known)].sort((a,b)=>b.score-a.score||b.ranked-a.ranked||a.name.localeCompare(b.name))[0]||null;}
    const years=new Map();for(const r of rides)if(r.riddenOn){const year=r.riddenOn.slice(0,4);years.set(year,(years.get(year)||0)+1);}
    return {rides,ranked,top10:ranked.slice(0,10),ranks,manufacturers,types,parks,countries,favorites:{manufacturer:favorite(manufacturers),type:favorite(types),park:favorite(parks)},
      totals:{credits,rides:rides.length,ranked:ranked.length,unranked:rides.length-ranked.length,parks:parks.filter(p=>p.known&&p.credits).length,countries:countries.filter(p=>p.known&&p.credits).length,manufacturers:manufacturers.filter(p=>p.known&&p.credits).length,wishes:wishes.length,parkWishes:clean.parkWishlist.length},
      coverage:{manufacturer:C.creditCount(rides.filter(r=>!unknown(r.manufacturer))),type:C.creditCount(rides.filter(r=>!unknown(r.type))),country:C.creditCount(rides.filter(r=>!unknown(r.country))),park:C.creditCount(rides.filter(r=>r.park)),dates:rides.filter(r=>r.riddenOn).length},
      years:[...years].sort(([a],[b])=>a.localeCompare(b)).map(([name,credits])=>({name,credits})),mapped:parks.filter(p=>p.credits&&p.location),unmapped:parks.filter(p=>p.credits&&p.known&&!p.location),demo:clean.rides.some(r=>r.demoRide)};
  }
  // Screen-space clustering keeps nearby parks readable while preserving every credit.
  function clusters(parks,view={x:0,y:0,width:1440,height:720},screenWidth=900){
    const radius=24*view.width/Math.max(200,screenWidth),result=[];
    for(const park of [...parks].sort((a,b)=>a.key.localeCompare(b.key))){const x=(park.location.lon+180)*4,y=(90-park.location.lat)*4;
      if(x<view.x-radius||x>view.x+view.width+radius||y<view.y-radius||y>view.y+view.height+radius)continue;
      let group=result.find(g=>Math.hypot(g.x-x,g.y-y)<radius*1.6);
      if(!group){group={x,y,parks:[],credits:0};result.push(group);}group.parks.push(park);group.credits+=park.credits;
    }
    return result;
  }
  function fit(parks,detailed=false){if(!parks.length)return {x:0,y:0,width:1440,height:720};const xs=parks.map(p=>(p.location.lon+180)*4),ys=parks.map(p=>(90-p.location.lat)*4);
    const width=Math.min(1440,Math.max(detailed?.09:4,(Math.max(...xs)-Math.min(...xs))*1.3,(Math.max(...ys)-Math.min(...ys))*2.6)),height=width/2;
    return {x:Math.max(0,Math.min(1440-width,(Math.max(...xs)+Math.min(...xs)-width)/2)),y:Math.max(0,Math.min(720-height,(Math.max(...ys)+Math.min(...ys)-height)/2)),width,height};
  }
  const api={analyze,clusters,fit};root.TracklistStatisticsModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
