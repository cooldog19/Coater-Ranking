/* Shared, dependency-free data model; also used by the Node regression tests. */
(function (root) {
  'use strict';
  const VERSION = 2;
  const LIMIT = 5000;
  const TYPES = ['Steel', 'Wooden', 'Hybrid', 'Other'];
  const uid = () => globalThis.crypto?.randomUUID?.() || `ride-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
  const fold = value => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
  // Track labels verified against the ride operator / public catalog; see README.md.
  const trackFamilies=[
    {id:'stardust',name:'Stardust Racers',parks:['Universal Epic Universe','Epic Universe'],rcdb:'https://rcdb.com/20549.htm',tracks:['Green','Yellow']},
    {id:'gwazi',name:'Gwazi',parks:['Busch Gardens Tampa','Busch Gardens Tampa Bay'],rcdb:'https://rcdb.com/533.htm',tracks:['Lion','Tiger']},
  ];
  function trackFamily(r){return trackFamilies.find(f=>f.parks.some(p=>fold(p)===fold(r.park))&&(fold(r.name)===fold(f.name)||f.tracks.some(t=>[fold(f.name+t),fold(f.name+t+'track'),fold(f.name+t+'side')].includes(fold(r.name)))));}
  const creditValue = r => Math.max(1,(Array.isArray(r.tracks)?r.tracks:[]).filter(t=>t.ridden).length);
  const creditCount = rides => rides.reduce((n,r)=>n+creditValue(r),0);
  function validDate(value,name){const date=clean(value,10);if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw new Error(`Invalid ride date for ${name}. Use a real date in YYYY-MM-DD format.`);return date;}
  function trackList(value){if(value===undefined||value==='')return [];if(typeof value==='string'){try{value=JSON.parse(value);}catch{throw new Error('Track details must be a JSON list.');}}
    if(!Array.isArray(value)||value.length>8)throw new Error('A ride can have up to eight named tracks.');const names=new Set(),ids=new Set();
    return value.map(t=>{const name=clean(t?.name,80);if(!name||names.has(fold(name)))throw new Error('Give each track a different name.');names.add(fold(name));let id=clean(t.id,100)||uid();if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)||ids.has(id))id=uid();ids.add(id);
      if(t.ridden!==undefined&&typeof t.ridden!=='boolean')throw new Error('Choose whether each track has been ridden.');
      return {id,name,ridden:t.ridden===true,notes:clean(t.notes,10000),riddenOn:validDate(t.riddenOn,name),rcdb:rcdbURL(t.rcdb),pov:povURL(t.pov),catalogId:clean(t.catalogId,100),originalName:clean(t.originalName,160)};});
  }
  function trackReference(parent,t,other){return !!(t.catalogId&&(t.catalogId===other.catalogId||t.catalogId===other.id))||!!(t.rcdb&&t.rcdb===other.rcdb)||(fold(parent.park)===fold(other.park)&&[t.originalName,parent.name+t.name,parent.name+t.name+'track',parent.name+t.name+'side'].filter(Boolean).some(name=>fold(name)===fold(other.name)));}
  function sameRide(a,b){const fa=trackFamily(a),fb=trackFamily(b);return !!(fa&&fb&&fa.id===fb.id)||!!(a.rcdb&&a.rcdb===b.rcdb)||(fold(a.name)===fold(b.name)&&fold(a.park)===fold(b.park))||[a,b].some((r,i)=>(r.tracks||[]).some(t=>trackReference(r,t,[a,b][1-i])));}
  function joinNotes(a,b){const text=!a?b:!b||a===b?a:a+'\n\n'+b;if(text?.length>10000)throw new Error('Combined notes exceed 10,000 characters. Shorten them before combining tracks.');return text||'';}
  function unionTracks(a,b){const tracks=(a.tracks||[]).map(t=>({...t}));for(const incoming of b.tracks||[]){const old=tracks.find(t=>fold(t.name)===fold(incoming.name));if(old){old.ridden=old.ridden||incoming.ridden;old.notes=joinNotes(old.notes,incoming.notes);for(const key of ['riddenOn','rcdb','pov','catalogId'])if(!old[key])old[key]=incoming[key];}else tracks.push({...incoming});}
    const favorite=b.tracks?.find(t=>t.id===b.preferredTrack);return ride({...a,tracks,notes:joinNotes(a.notes,b.notes),riddenOn:[a.riddenOn,b.riddenOn].filter(Boolean).sort()[0]||'',preferredTrack:a.preferredTrack||(favorite?tracks.find(t=>fold(t.name)===fold(favorite.name))?.id:'')||''});}
  function coalesceKnown(rides){const result=[];for(const r of canonical(rides)){const family=trackFamily(r),index=family&&r.tracks?.some(t=>t.ridden)?result.findIndex(x=>trackFamily(x)?.id===family.id&&x.tracks?.some(t=>t.ridden)):-1;if(index<0)result.push(r);else{try{result[index]=unionTracks(result[index],r);}catch{result.push(r);}}}return result;}
  function combineRides(primary,other,labels){if(fold(primary.park)!==fold(other.park)&&!(trackFamily(primary)&&trackFamily(primary)?.id===trackFamily(other)?.id))throw new Error('Combine track entries from the same park.');
    if(!primary.tracks?.some(t=>t.ridden)&&!other.tracks?.some(t=>t.ridden)&&fold(labels?.[0]||primary.name)===fold(labels?.[1]||other.name))throw new Error('Give the two track entries distinct track names.');
    const toTracks=(r,label,secondary)=>{const tracks=(r.tracks||[]).map(t=>({...t}));if(!tracks.some(t=>t.ridden)){const name=label||r.name,old=tracks.find(t=>fold(t.name)===fold(name));const chosen={id:old?.id||uid(),name,ridden:true,notes:joinNotes(old?.notes||'',r.notes),riddenOn:old?.riddenOn||r.riddenOn,rcdb:old?.rcdb||r.rcdb,pov:old?.pov||r.pov,catalogId:old?.catalogId||r.catalogId,originalName:old?.originalName||r.name};if(old)Object.assign(old,chosen);else tracks.push(chosen);}else if(secondary&&r.notes&&!tracks.some(t=>t.notes===r.notes)){const first=tracks.find(t=>t.ridden);first.notes=joinNotes(first.notes,r.notes);}return tracks;};
    const a={...primary,tracks:toTracks(primary,labels?.[0],false)},b={...other,notes:'',tracks:toTracks(other,labels?.[1],true)};
    return unionTracks({...a,ranked:primary.ranked||other.ranked},b);}
  const canonical = rides => [...rides.filter(r => r.ranked), ...rides.filter(r => !r.ranked)];
  function povURL(value) {
    const text = clean(value, 2000);
    if (!text) return '';
    let url;
    try { url = new URL(text); } catch { throw new Error('Use a complete YouTube URL, starting with https://.'); }
    if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname) || url.port || url.username || url.password) {
      throw new Error('POV links must be HTTPS YouTube or youtu.be links.');
    }
    return url.href;
  }
  function rcdbURL(value) {
    const text=clean(value,2000);if(!text)return '';
    const url=/^[1-9]\d*$/.test(text)?new URL(`https://rcdb.com/${text}.htm`):new URL(text);
    if(url.protocol!=='https:' || url.hostname!=='rcdb.com' || !/^\/[1-9]\d*\.htm$/.test(url.pathname) || url.port || url.username || url.password || url.search || url.hash)throw new Error('Use an RCDB ride page URL such as https://rcdb.com/123.htm.');
    return url.href;
  }
  function ride(raw, usedIds = new Set()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Each ride must be a record with a name.');
    let name = clean(raw.name, 160);
    if (!name) throw new Error('Every ride needs a name.');
    let id = clean(raw.id, 100) || uid();
    if (usedIds.has(id)) id = uid();
    usedIds.add(id);
    const type = clean(raw.type, 30);
    const family=trackFamily(raw),side=family?.tracks.find(t=>fold(raw.name)!==fold(family.name)&&fold(raw.name).includes(fold(t)));
    let tracks=trackList(raw.tracks);
    if(raw.tracks===undefined&&family){tracks=family.tracks.map(t=>({id:fold(t),name:t,ridden:t===side,notes:t===side?clean(raw.notes,10000):'',riddenOn:t===side?validDate(raw.riddenOn,name):'',rcdb:t===side?rcdbURL(raw.rcdb):'',pov:t===side?povURL(raw.pov):'',catalogId:t===side?clean(raw.catalogId,100):'',originalName:t===side?raw.name:''}));name=family.name;}
    if(family)name=family.name;
    const result = {
      id, name, park: clean(raw.park, 160), country: clean(raw.country, 80),
      type: TYPES.find(t => t.toLowerCase() === type.toLowerCase()) || 'Other',
      manufacturer: clean(raw.manufacturer, 100), notes: clean(raw.notes, 10000),
      pov: povURL(raw.pov), riddenOn: clean(raw.riddenOn, 10), ranked: raw.ranked !== false, demoRide: raw.demoRide === true,
      rcdb: rcdbURL(raw.rcdb||family?.rcdb), catalogId:clean(raw.catalogId,100),
      source: /^https?:\/\/(coasterpedia\.net|www\.wikidata\.org)\//.test(raw.source||'')?clean(raw.source,2000).replace(/^http:/,'https:'):'',
      license: /^https?:\/\/coasterpedia\.net\//.test(raw.source||'')?'CC-BY-SA-4.0':/^https?:\/\/www\.wikidata\.org\//.test(raw.source||'')?'CC0-1.0':'',
    };
    if(tracks.length){result.tracks=tracks;result.preferredTrack=tracks.some(t=>t.id===raw.preferredTrack&&t.ridden)?raw.preferredTrack:'';}
    if (result.riddenOn && (!/^\d{4}-\d{2}-\d{2}$/.test(result.riddenOn) || Number.isNaN(Date.parse(result.riddenOn)) || new Date(result.riddenOn).toISOString().slice(0,10) !== result.riddenOn)) throw new Error(`Invalid ride date for ${name}. Use a real date in YYYY-MM-DD format.`);
    return result;
  }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || ![1,VERSION].includes(raw.version) || !Array.isArray(raw.rides)) throw new Error('This is not a supported Tracklist backup (version 1 or 2).');
    if (raw.rides.length > LIMIT) throw new Error(`A collection can contain up to ${LIMIT.toLocaleString()} rides.`);
    const ids = new Set();
    const wishlist=raw.wishlist===undefined?[]:raw.wishlist;
    if(!Array.isArray(wishlist))throw new Error('Invalid ride wish list.');
    if(wishlist.length>LIMIT)throw new Error('Your wish list exceeds the collection limit.');
    const rides=coalesceKnown(raw.rides.map(r=>ride(r,ids)));if(creditCount(rides)>LIMIT)throw new Error(`A collection can contain up to ${LIMIT.toLocaleString()} credits, including ridden tracks.`);
    return {version: VERSION, demo: raw.demo === true, rides,wishlist:wishlist.map(r=>ride({...r,ranked:false},ids)),parkWishlist:parkList(raw.parkWishlist||[]), updatedAt: clean(raw.updatedAt, 40)};
  }
  function parkList(parks){
    if(!Array.isArray(parks)||parks.length>LIMIT)throw new Error('Invalid park wish list.');
    const seen=new Set();return parks.map(p=>{const name=clean(p?.name,160);if(!name)throw new Error('Every saved park needs a name.');return {id:clean(p.id,160)||name.toLowerCase(),name,country:clean(p.country,80)};}).filter(p=>{if(seen.has(p.id))return false;seen.add(p.id);return true;});
  }
  function move(rides, ids, destination) {
    const selected = new Set(ids);
    const moving = rides.filter(r => selected.has(r.id)).map(r => ({...r, ranked: true}));
    const ranked = rides.filter(r => r.ranked && !selected.has(r.id));
    const position = Math.min(Math.max(0, Number(destination) - 1 || 0), ranked.length);
    ranked.splice(position, 0, ...moving);
    return [...ranked, ...rides.filter(r => !r.ranked && !selected.has(r.id))];
  }
  function unrank(rides, ids) {
    const selected = new Set(ids);
    return canonical(rides.map(r => selected.has(r.id) ? {...r, ranked: false} : r));
  }
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const firstLine = text.split(/\r?\n/, 1)[0];
    const separator = firstLine.includes('\t') ? '\t' : (!firstLine.includes(',') && firstLine.includes(';') ? ';' : ',');
    const rows = []; let row = [], cell = '', quoted = false, closed = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') { quoted = false; closed = true; }
        else cell += c;
      } else if (c === '"') {
        if (cell || closed) throw new Error('CSV has an unexpected quote. Quote the entire field and double quotes inside it.');
        quoted = true;
      } else if (c === separator) { row.push(cell); cell = ''; closed = false; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); if (row.some(s => s.trim())) rows.push(row);
        row = []; cell = ''; closed = false;
      } else {
        if (closed && !/\s/.test(c)) throw new Error('CSV has text after a closing quote.');
        if (!closed) cell += c;
      }
    }
    if (quoted) throw new Error('CSV contains an unclosed quoted field.');
    row.push(cell); if (row.some(s => s.trim())) rows.push(row);
    return rows;
  }
  const aliases = {
    name: ['name', 'ride', 'ridename', 'coaster', 'coastername', 'rollercoaster', 'rollercoastername'],
    park: ['park', 'parkname', 'amusementpark', 'location'], country: ['country'],
    type: ['type', 'coastertype'], manufacturer: ['manufacturer', 'builder'],
    notes: ['notes', 'note', 'comments'], pov: ['pov', 'povurl', 'youtube', 'youtubelink', 'video'],
    riddenOn: ['riddenon', 'date', 'ridedate'], rank: ['rank', 'ranking', 'position'], ranked: ['ranked'],
    rcdb:['rcdb','rcdburl','rcdbid','rcdbnumber'], catalogId:['catalogid'],source:['source','catalogsource'],
    tracks:['tracks','trackdetails'],preferredTrack:['preferredtrack','favoritetrack'],
  };
  function importText(text, filename = '') {
    if (text.length > 15 * 1024 * 1024) throw new Error('Choose a backup smaller than 15 MB.');
    if (!text.trim()) throw new Error('The file is empty.');
    if (/\.json$/i.test(filename) || /^[\s]*[\[{]/.test(text)) {
      let data; try { data = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('This JSON file is incomplete or invalid.'); }
      return normalize(Array.isArray(data) ? {version: VERSION, rides: data} : data);
    }
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('CSV needs a header and at least one ride. Example: name,park,rank');
    const header = rows.shift().map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
    const columns = {};
    for (const [key, names] of Object.entries(aliases)) columns[key] = header.findIndex(h => names.includes(h));
    if (columns.name < 0) throw new Error('CSV needs a Name, Ride, or Coaster column. You can also paste ride names using Add a ride → Add several.');
    if (rows.length > LIMIT) throw new Error(`Import supports up to ${LIMIT.toLocaleString()} rides.`);
    const ids = new Set();
    const rides = rows.map((row, index) => {
      if (row.length !== header.length) throw new Error(`CSV row ${index + 2} has ${row.length} fields; the header has ${header.length}.`);
      const raw = {};
      for (const [key, column] of Object.entries(columns)) if (column >= 0) raw[key] = row[column];
      const hasRank = columns.rank >= 0;
      const rank = Number(raw.rank);
      if (hasRank && raw.rank?.trim() && (!Number.isInteger(rank) || rank < 1)) throw new Error(`Invalid rank on CSV row ${index + 2}. Use a positive whole number or leave it blank.`);
      raw.ranked = hasRank ? !!raw.rank.trim() : (columns.ranked >= 0 ? /^(true|yes|1)$/i.test(raw.ranked.trim()) : false);
      try { return {...ride(raw, ids), importRank: raw.ranked && hasRank ? rank : index + 1}; }
      catch (error) { throw new Error(`CSV row ${index + 2}: ${error.message}`); }
    });
    rides.sort((a, b) => a.importRank - b.importRank);
    return normalize({version: VERSION, rides});
  }
  function exportCSV(rides) {
    const fields = ['name', 'park', 'rank', 'type', 'country', 'manufacturer', 'notes', 'pov', 'riddenOn','rcdb','catalogId','source','license','tracks','preferredTrack','credits'];
    // Quoting alone does not prevent spreadsheet formula execution. JSON is the lossless backup.
    const escape = value => {let text=String(value ?? '');if(/^[\s\u0000-\u001f]*[=+@-]/.test(text))text="'"+text;return `"${text.replace(/"/g, '""')}"`;};
    let rank = 0;
    return '\uFEFF' + [fields.join(','), ...rides.map(r => fields.map(f => escape(f === 'rank' ? (r.ranked ? ++rank : '') : f==='tracks'?JSON.stringify(r.tracks||[]):f==='credits'?creditValue(r):r[f])).join(','))].join('\r\n');
  }
  function merge(existing, incoming, preview = false) {
    const key = r => `${r.name.toLocaleLowerCase().trim()}\u0000${r.park.toLocaleLowerCase().trim()}`;
    const names = new Set(existing.map(key));
    const rcdbs=new Set(existing.map(r=>r.rcdb).filter(Boolean));
    const ids = new Set(existing.map(r => r.id));
    const added = [],kept=existing.map(r=>({...r}));let updated=0;
    for (const raw of incoming){const r=ride(raw,ids),old=kept.concat(added).find(x=>sameRide(x,r));if(old){let details=r;if(old.tracks&&!r.tracks){const track=old.tracks.find(t=>trackReference(old,t,r));if(track)details={...r,tracks:[{...track,ridden:true,notes:r.notes,riddenOn:r.riddenOn,rcdb:r.rcdb||track.rcdb,pov:r.pov||track.pov,catalogId:r.catalogId||track.catalogId}]};}if(old.tracks&&details.tracks){const next=unionTracks(old,details);if(JSON.stringify(next.tracks)!==JSON.stringify(old.tracks)){Object.assign(old,next);updated++;}}continue;}names.add(key(r));if(r.rcdb)rcdbs.add(r.rcdb);added.push(r);}
    if (!preview && existing.length + added.length > LIMIT) throw new Error(`This import exceeds the ${LIMIT.toLocaleString()}-ride collection limit. Choose Replace instead, or import fewer rides.`);
    const rides=coalesceKnown([...kept,...added]);if(!preview&&creditCount(rides)>LIMIT)throw new Error('This import exceeds the 5,000-credit collection limit.');
    return {rides, added: added.length, skipped: incoming.length - added.length,updated,creditsAdded:Math.max(0,creditCount(rides)-creditCount(existing))};
  }
  function sample() {
    const samples = [
      ['Steel Vengeance', 'Cedar Point', 'United States', 'Hybrid', 'Rocky Mountain Construction', 'That final run of airtime is something else. Back row, every time.'],
      ['VelociCoaster', 'Universal Islands of Adventure', 'United States', 'Steel', 'Intamin', 'The lagoon roll. Enough said.'],
      ['Fury 325', 'Carowinds', 'United States', 'Steel', 'Bolliger & Mabillard', 'Fast, smooth, and ridiculously re-rideable.'],
      ['Iron Gwazi', 'Busch Gardens Tampa Bay', 'United States', 'Hybrid', 'Rocky Mountain Construction', ''],
      ['Millennium Force', 'Cedar Point', 'United States', 'Steel', 'Intamin', ''],
      ['The Voyage', 'Holiday World', 'United States', 'Wooden', 'The Gravity Group', 'A night ride to remember.'],
      ['Maverick', 'Cedar Point', 'United States', 'Steel', 'Intamin', ''],
      ['El Toro', 'Six Flags Great Adventure', 'United States', 'Wooden', 'Intamin', ''],
      ['Twisted Timbers', 'Kings Dominion', 'United States', 'Hybrid', 'Rocky Mountain Construction', ''],
      ['Phoenix', 'Knoebels', 'United States', 'Wooden', 'Philadelphia Toboggan Coasters', ''],
      ['Orion', 'Kings Island', 'United States', 'Steel', 'Bolliger & Mabillard', ''],
      ['Mystic Timbers', 'Kings Island', 'United States', 'Wooden', 'Great Coasters International', ''],
    ];
    return normalize({version: VERSION, demo: true, rides: samples.map((s, i) => ({name:s[0],park:s[1],country:s[2],type:s[3],manufacturer:s[4],notes:s[5],ranked:i < 10,demoRide:true}))});
  }
  const api = {VERSION, LIMIT, TYPES, uid, clean, canonical, ride, normalize, move, unrank, parseCSV, importText, exportCSV, merge, sample, povURL,rcdbURL,parkList,creditValue,creditCount,trackList,trackFamily,sameRide,combineRides};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tracklist = api;
})(globalThis);
