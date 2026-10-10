/* Shared, dependency-free data model; also used by the Node regression tests. */
(function (root) {
  'use strict';
  const VERSION = 1;
  const LIMIT = 5000;
  const TYPES = ['Steel', 'Wooden', 'Hybrid', 'Other'];
  const uid = () => globalThis.crypto?.randomUUID?.() || `ride-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
  const canonical = rides => [...rides.filter(r => r.ranked), ...rides.filter(r => !r.ranked)];
  function povURL(value) {
    const text = clean(value, 2000);
    if (!text) return '';
    let url;
    try { url = new URL(text); } catch { throw new Error('Use a complete YouTube URL, starting with https://.'); }
    if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname) || url.username || url.password) {
      throw new Error('POV links must be HTTPS YouTube or youtu.be links.');
    }
    return url.href;
  }
  function ride(raw, usedIds = new Set()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Each ride must be a record with a name.');
    const name = clean(raw.name, 160);
    if (!name) throw new Error('Every ride needs a name.');
    let id = clean(raw.id, 100) || uid();
    if (usedIds.has(id)) id = uid();
    usedIds.add(id);
    const type = clean(raw.type, 30);
    const result = {
      id, name, park: clean(raw.park, 160), country: clean(raw.country, 80),
      type: TYPES.find(t => t.toLowerCase() === type.toLowerCase()) || 'Other',
      manufacturer: clean(raw.manufacturer, 100), notes: clean(raw.notes, 10000),
      pov: povURL(raw.pov), riddenOn: clean(raw.riddenOn, 10), ranked: raw.ranked !== false, demoRide: raw.demoRide === true,
    };
    if (result.riddenOn && (!/^\d{4}-\d{2}-\d{2}$/.test(result.riddenOn) || Number.isNaN(Date.parse(result.riddenOn)) || new Date(result.riddenOn).toISOString().slice(0,10) !== result.riddenOn)) throw new Error(`Invalid ride date for ${name}. Use a real date in YYYY-MM-DD format.`);
    return result;
  }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION || !Array.isArray(raw.rides)) throw new Error('This is not a supported Tracklist backup (version 1).');
    if (raw.rides.length > LIMIT) throw new Error(`A collection can contain up to ${LIMIT.toLocaleString()} rides.`);
    const ids = new Set();
    return {version: VERSION, demo: raw.demo === true, rides: canonical(raw.rides.map(r => ride(r, ids))), updatedAt: clean(raw.updatedAt, 40)};
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
    const fields = ['name', 'park', 'rank', 'type', 'country', 'manufacturer', 'notes', 'pov', 'riddenOn'];
    const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    let rank = 0;
    return '\uFEFF' + [fields.join(','), ...rides.map(r => fields.map(f => escape(f === 'rank' ? (r.ranked ? ++rank : '') : r[f])).join(','))].join('\r\n');
  }
  function merge(existing, incoming, preview = false) {
    const key = r => `${r.name.toLocaleLowerCase().trim()}\u0000${r.park.toLocaleLowerCase().trim()}`;
    const names = new Set(existing.map(key));
    const ids = new Set(existing.map(r => r.id));
    const added = [];
    for (const r of incoming) if (!names.has(key(r))) { names.add(key(r)); added.push(ride(r, ids)); }
    if (!preview && existing.length + added.length > LIMIT) throw new Error(`This import exceeds the ${LIMIT.toLocaleString()}-ride collection limit. Choose Replace instead, or import fewer rides.`);
    return {rides: canonical([...existing, ...added]), added: added.length, skipped: incoming.length - added.length};
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
  const api = {VERSION, LIMIT, TYPES, uid, clean, canonical, ride, normalize, move, unrank, parseCSV, importText, exportCSV, merge, sample, povURL};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tracklist = api;
})(globalThis);
