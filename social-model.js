(function(root){
  'use strict';
  const C=root.Tracklist||(typeof require==='function'?require('./core.js'):null);
  const uid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
  function username(value){
    const name=String(value||'').trim().replace(/^@/,'').toLowerCase();
    if(!/^[a-z][a-z0-9_]{2,23}$/.test(name))throw new Error('Use 3–24 letters, numbers or underscores, starting with a letter.');
    return name;
  }
  function settings(data){
    if(!data)return null;
    if(username(data.username)!==data.username||typeof data.visible!=='boolean'||!Array.isArray(data.friendIds)||data.friendIds.length>500||data.friendIds.some(id=>!uid(id))||new Set(data.friendIds).size!==data.friendIds.length)throw new Error('Social settings could not be read. Please try again.');
    return {username:data.username,visible:data.visible,friendIds:[...data.friendIds]};
  }
  function ride(raw){
    const normalized=C.ride(raw);
    // An explicit allowlist prevents private notes, dates and future private fields being shared.
    const fields=['id','name','park','country','type','manufacturer','ranked','rcdb','pov','catalogId'];
    const result=Object.fromEntries(fields.map(key=>[key,normalized[key]|| (key==='ranked'?false:'')]));
    if(normalized.tracks){result.tracks=normalized.tracks.map(({id,name,ridden,rcdb,pov,catalogId})=>({id,name,ridden,rcdb,pov,catalogId}));result.preferredTrack=normalized.preferredTrack||'';}
    if(raw.source){try{const u=new URL(raw.source);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['coasterpedia.net','www.wikidata.org'].includes(u.hostname)){result.source=u.href;result.license=String(raw.license||'').slice(0,100);}}catch{}}
    return result;
  }
  function project(state){
    const clean=C.normalize(state);
    return {version:C.VERSION,rides:clean.rides.filter(r=>!r.demoRide).map(ride),wishlist:clean.wishlist.map(ride),parkWishlist:clean.parkWishlist.map(({id,name,country})=>({id,name,country}))};
  }
  function parse(text){
    let raw;try{raw=JSON.parse(text);}catch{throw new Error('This profile could not be read. Try again later.');}
    return project(raw);
  }
  function stats(data){
    return {credits:C.creditCount(data.rides),ranked:data.rides.filter(r=>r.ranked).length,parks:new Set(data.rides.map(r=>r.park.trim().toLowerCase()).filter(Boolean)).size,wishes:data.wishlist.length,parkWishes:data.parkWishlist.length};
  }
  function header(data){
    const counts=['credits','ranked','parks','wishes','parkWishes'];
    if(!data||username(data.username)!==data.username||typeof data.visible!=='boolean'||typeof data.at!=='string'||!Number.isFinite(Date.parse(data.at))||counts.some(key=>!Number.isInteger(data[key])||data[key]<0||data[key]>5000)||data.ranked>data.credits)throw new Error('This profile is unavailable. Try again later.');
    if(data.visible){if(!/^[A-Za-z0-9_-]{1,100}$/.test(data.revision)||!/^[A-Za-z0-9_-]{1,100}$/.test(data.sourceRevision)||!Number.isInteger(data.parts)||data.parts<1||data.parts>60)throw new Error('This profile is unavailable. Try again later.');}
    else if(data.revision!==''||data.sourceRevision!==''||data.parts!==0||counts.some(key=>data[key]!==0))throw new Error('This profile is unavailable. Try again later.');
    return {username:data.username,visible:data.visible,revision:data.revision,sourceRevision:data.sourceRevision,parts:data.parts,at:data.at,...Object.fromEntries(counts.map(key=>[key,data[key]]))};
  }
  const hidden=name=>({username:username(name),visible:false,revision:'',sourceRevision:'',parts:0,at:new Date().toISOString(),credits:0,ranked:0,parks:0,wishes:0,parkWishes:0});
  const api={uid,username,settings,project,parse,stats,header,hidden};root.TracklistSocialModel=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
