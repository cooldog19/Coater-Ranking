(() => {
  'use strict';
  const C = Tracklist;
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    ranking:'<path d="M5 20V10h4v10M10 20V4h4v16M15 20v-7h4v7"/>',
    inbox:'<path d="M4 5h16v14H4zM4 13h5l2 3h2l2-3h5"/>',
    ticket:'<path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4zM9 5v2m0 3v2m0 3v4"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',
    external:'<path d="M14 3h7v7M21 3l-9 9M10 4H4v16h16v-6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    park:'<path d="M3 20h18M7 20V8l5-4 5 4v12M4 20v-8h3m10 0h3v8M10 20v-5h4v5M11 9h2"/>',
    star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    grip:'<circle cx="9" cy="5" r=".8"/><circle cx="15" cy="5" r=".8"/><circle cx="9" cy="12" r=".8"/><circle cx="15" cy="12" r=".8"/><circle cx="9" cy="19" r=".8"/><circle cx="15" cy="19" r=".8"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    note:'<path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/>',
    play:'<rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    undo:'<path d="M4 10h9a6 6 0 0 1 0 12M4 10l5-5m-5 5 5 5"/>',
    up:'<path d="m6 14 6-6 6 6"/>', down:'<path d="m6 10 6 6 6-6"/>',
    cloud:'<path d="M6 18h12a4 4 0 0 0 0-8 6 6 0 0 0-11-2 5 5 0 0 0-1 10z"/>',
    people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/>',
    chart:'<path d="M4 3v18h17M8 16v-4M13 16V7M18 16v-7"/>',
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.ticket}</svg>`;
  document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
  let STORAGE = 'tracklist.collection.v1';const EXPORT_KEY = 'tracklist.lastExport';
  let state, view = 'ranked', query = '', selection = new Set(), history = [], toastTimer, lastSelected = null;
  let storageBlocked = false, recoveryRaw = '', saveFailed = false, pendingImport = null, drag = null, dragFrame = null;
  try {
    const raw = localStorage.getItem(STORAGE);
    state = raw ? C.normalize(JSON.parse(raw)) : C.sample();
  } catch (error) {
    state = C.normalize({version:1, rides:[]});
    storageBlocked = true;
    try { recoveryRaw = localStorage.getItem(STORAGE) || ''; } catch {}
    showStorageWarning('Your saved collection could not be read. It has been preserved. Download a recovery file in Data & backup before importing a valid backup or starting a new collection.');
  }
  function showStorageWarning(message) { $('storage-warning').textContent = message; $('storage-warning').hidden = false; }
  function persist() {
    if (storageBlocked) { saveFailed = true; updateSaveStatus(); return; }
    try {
      localStorage.setItem(STORAGE, JSON.stringify(state));
      saveFailed = false; $('storage-warning').hidden = true;
    } catch {
      saveFailed = true;
      showStorageWarning('Browser saving is unavailable or full. Your changes are in this tab only. Export a JSON backup before closing it.');
    }
    updateSaveStatus();
  }
  function updateSaveStatus() { $('save-status').innerHTML = `<span class="status-dot" style="${saveFailed ? 'background:#db7151' : ''}"></span>${saveFailed ? 'Backup needed' : 'Saved on this device'}`; }
  function checkpoint(force=false){try{globalThis.TracklistRecovery?.save(localStorage,state,STORAGE,force);}catch{}}
  function commit(rides, message, demo = state.demo, wishlist = state.wishlist, parkWishlist = state.parkWishlist) {
    if (rides.length > C.LIMIT || C.creditCount(rides)>C.LIMIT || wishlist.length>C.LIMIT || parkWishlist.length>C.LIMIT) { toast(`Your collection can contain up to ${C.LIMIT.toLocaleString()} credits, including ridden tracks.`, false); return false; }
    let next;try{next=C.normalize({...state,rides,wishlist,parkWishlist,demo:demo&&rides.some(r=>r.demoRide),updatedAt:new Date().toISOString()});}catch(error){toast(error.message,false);return false;}
    checkpoint(true);
    history.push(JSON.stringify(state)); if (history.length > 30) history.shift();
    state = next;
    selection = new Set([...selection].filter(id => rides.some(r => r.id === id)));
    persist();checkpoint();render(); toast(message);document.dispatchEvent(new Event('tracklist:change')); return true;
  }
  function undo() {
    if (!history.length) return;
    state = C.normalize(JSON.parse(history.pop())); selection.clear(); persist(); render(); toast('Last change undone.', false);document.dispatchEvent(new Event('tracklist:change'));
  }
  function toast(message, undoable = true) {
    clearTimeout(toastTimer); $('toast-text').textContent = message;
    $('toast-undo').hidden = !undoable || !history.length; $('toast').hidden = false;
    $('announcement').textContent = message;
    toastTimer = setTimeout(() => $('toast').hidden = true, 6500);
  }
  function visibleRides() {
    return state.rides.filter(r => (view === 'all' || r.ranked === (view === 'ranked')) && `${r.name} ${r.park} ${r.country} ${r.type} ${r.manufacturer} ${r.notes}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  }
  function art(r) {
    const palette = [['#edf3df','#789654'],['#e4eeee','#5b8983'],['#f4ecde','#af915d'],['#f6e7df','#b38265'],['#e7eaf2','#7c87ac']];
    const hash = [...r.name].reduce((a,c) => a+c.charCodeAt(0),0); const [bg,ink] = palette[hash % palette.length];
    const tracks = ['M-2 26C7 26 5 5 17 5S25 26 37 26 48 9 53 9','M-2 27C9 27 8 4 22 4S32 29 39 29 43 15 53 15','M-2 20C10 20 10 8 18 8S24 28 34 28 37 4 44 4 45 20 53 20'];
    return `<span class="ride-art" style="--art-bg:${bg};--art-ink:${ink}" aria-hidden="true"><svg viewBox="0 0 50 36"><path class="support" d="M8 14v22M17 6v30M26 18v18M37 26v10M44 15v21"/><path d="${tracks[hash % 3]}"/><path transform="translate(0 4)" d="${tracks[hash % 3]}"/></svg></span>`;
  }
  function render() {
    const ranked = state.rides.filter(r => r.ranked), unranked = state.rides.length - ranked.length, visible = visibleRides();
    const titles = {ranked:'My ranking',unranked:'Unranked',all:'Credits',explore:'Explore parks',wishlist:'Wish list',social:'Social',statistics:'Statistics'};
    const descriptions = {ranked:'Drag rides to reorder, or click a rank to move them.',unranked:'Place your new credits in the ranking.',all:'Your complete ridden coaster collection.',explore:'Search parks and rides, then log credits or save parks.',wishlist:'Keep track of parks to visit and rides to try.',social:'Find your people. Compare your favorites.',statistics:'Find the patterns behind your favorites.'};
    $('ranking-panel').hidden=['explore','wishlist','social','statistics'].includes(view);$('explore-panel').hidden=view!=='explore';$('wishlist-panel').hidden=view!=='wishlist';if($('social-panel'))$('social-panel').hidden=view!=='social';if($('statistics-panel'))$('statistics-panel').hidden=view!=='statistics';
    if($('statistics-shortcut'))$('statistics-shortcut').hidden=!['ranked','unranked','all'].includes(view);
    $('add-button').hidden=!['all','wishlist'].includes(view);
    $('add-button').innerHTML=icon('plus')+(view==='wishlist'?'Wish List a Park/Ride':'Add a ride');
    $('credit-entry-note').hidden=!['ranked','unranked'].includes(view);
    $('wishlist-count').textContent=state.parkWishlist.length+state.wishlist.length;
    $('collection-stats').hidden=['explore','wishlist','social','statistics'].includes(view);
    $('page-title').innerHTML = `${titles[view]}<span>.</span>`;
    $('page-description').textContent = descriptions[view]; $('breadcrumb-view').textContent = titles[view];
    document.querySelectorAll('[data-view]').forEach(b => {b.classList.toggle('active', b.dataset.view === view); b.setAttribute('aria-pressed', String(b.dataset.view === view));});
    $('ranked-count').textContent = $('tab-ranked').textContent = $('stat-ranked').textContent = ranked.length;
    $('unranked-count').textContent = $('tab-unranked').textContent = unranked;
    $('all-count').textContent = $('stat-total').textContent = C.creditCount(state.rides);
    $('stat-parks').textContent = globalThis.TracklistStatisticsModel
      ? TracklistStatisticsModel.analyze(state).totals.parks
      : new Set(state.rides.map(r => r.park.trim().toLocaleLowerCase()).filter(Boolean)).size;
    $('stat-favorite').textContent = ranked[0]?.name || '—';
    $('demo-banner').hidden = !state.demo || ['explore','wishlist','social','statistics'].includes(view);
    $('reorder-hint').hidden = view === 'unranked';
    const plural = visible.length === 1 ? 'ride' : 'rides';
    $('list-summary').textContent = `${visible.length} ${plural}${query ? ' found' : view === 'ranked' ? ' in your ranking' : view === 'unranked' ? ' waiting to be ranked' : ' in your collection'}${view==='all'?' · '+C.creditCount(visible)+' credits':''}`;
    $('footer-summary').textContent = query ? `Showing ${visible.length} of ${state.rides.filter(r => view === 'all' || r.ranked === (view === 'ranked')).length} rides` : `${C.creditCount(state.rides)} credits · ${state.rides.length} rides · ${ranked.length} ranked`;
    const rankMap = new Map(ranked.map((r,i) => [r.id,i+1]));
    $('ride-list').innerHTML = visible.length ? visible.map(r => {
      const rank = rankMap.get(r.id), selected = selection.has(r.id);
      const pov = r.pov || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${r.name} ${r.park} roller coaster POV`)}`;
      return `<article class="ride-row ${selected ? 'selected' : ''}" data-id="${escape(r.id)}" data-position="${rank || ''}">
        <div class="row-controls">${r.ranked ? `<button class="drag-handle" data-action="drag" aria-label="Reorder ${escape(r.name)}. Use arrow keys to move, Home or End to jump." title="Drag to reorder · arrow keys to move">${icon('grip')}</button>` : '<span style="width:18px"></span>'}<input class="ride-select" type="checkbox" aria-label="Select ${escape(r.name)}" ${selected ? 'checked' : ''}></div>
        <button class="rank-button" data-action="rank" aria-label="${rank ? `Move ${escape(r.name)} from rank ${rank}` : `Rank ${escape(r.name)}`}" title="${rank ? 'Move to a specific rank' : 'Add to ranking'}">${rank || '+'}</button>
        <div class="ride-identity">${art(r)}<div class="ride-copy"><span class="ride-title">${escape(r.name)}</span><div class="ride-location">${escape(r.park || 'Park not added')}${r.country ? `<span>·</span><span class="country" style="margin:0;color:inherit">${escape(r.country)}</span>` : ''}</div>${r.tracks?.length?`<small class="ride-track-summary">${C.creditValue(r)} ${C.creditValue(r)===1?'credit':'credits'} · ${escape(r.tracks.filter(t=>t.ridden).map(t=>t.name).join(' / ')||'Track not recorded')}${r.preferredTrack?' · Favorite: '+escape(r.tracks.find(t=>t.id===r.preferredTrack)?.name):''}</small>`:''}${view==='all'&&r.tracks?`<details class="ride-track-details"><summary>Track credits</summary>${r.tracks.some(t=>t.ridden)?r.tracks.filter(t=>t.ridden).map(t=>`<div>${escape(t.name)} · 1 credit${t.id===r.preferredTrack?' · Favorite':''}</div>`).join(''):'<div>1 credit · Track not recorded</div>'}</details>`:''}</div></div>
        <div class="ride-type"><span class="type-badge">${escape(r.type)}</span></div>
        <div class="row-actions">${r.rcdb?`<a class="icon-button rcdb-link" href="${escape(r.rcdb)}" target="_blank" rel="noopener noreferrer" aria-label="RCDB page for ${escape(r.name)}" title="RCDB">RCDB</a>`:''}<a class="icon-button" href="${escape(pov)}" target="_blank" rel="noopener noreferrer" aria-label="${r.pov ? 'Watch' : 'Find'} ${escape(r.name)} POV on YouTube" title="${r.pov ? 'Watch POV' : 'Find a POV on YouTube'}">${icon('play')}</a><button class="icon-button ride-edit" data-action="edit" title="Ride details" aria-label="Edit ${escape(r.name)}">Edit</button></div>
      </article>`;
    }).join('') : emptyHTML();
    $('undo-button').disabled = !history.length;
    renderSelection(); updateSaveStatus();document.dispatchEvent(new Event('tracklist:render'));
  }
  function emptyHTML() {
    if (query) return `<div class="empty-state"><div class="empty-symbol">${icon('search')}</div><h2>No rides found.</h2><p>Try another ride, park, or a word from your notes.</p><button class="button" data-action="clear-search">Clear search</button></div>`;
    const isUnranked = view === 'unranked';
    return `<div class="empty-state"><div class="empty-symbol">${icon(isUnranked ? 'inbox' : 'ticket')}</div><h2>${isUnranked ? 'No unranked rides.' : 'No rides in this view.'}</h2><p>${isUnranked ? 'New credits can wait here until you’re ready to give them a place in your ranking.' : 'Add a coaster you’ve ridden, or bring in your collection from a JSON or CSV file.'}</p>${view==='all'?`<button class="button primary" data-action="add">${icon('plus')}Add a ride</button>`:'<button class="button primary" data-action="credits">Go to Credits</button>'}${isUnranked ? '' : '<button class="button" data-action="backup">Import a collection</button>'}</div>`;
  }
  function renderSelection() {
    $('bulk-toolbar').hidden = selection.size === 0; $('selection-count').textContent = `${selection.size} selected`;
    $('bulk-unrank').hidden = !state.rides.some(r => r.ranked && selection.has(r.id));
    const visible = visibleRides(), count = visible.filter(r => selection.has(r.id)).length;
    $('select-all').checked = !!visible.length && count === visible.length;
    $('select-all').indeterminate = count > 0 && count < visible.length;
    $('select-all').disabled = !visible.length;
    $('bulk-rank').max = Math.max(1,state.rides.filter(r => r.ranked && !selection.has(r.id)).length + 1);
    document.querySelectorAll('.ride-row').forEach(row => {const on = selection.has(row.dataset.id); row.classList.toggle('selected',on); row.querySelector('.ride-select').checked = on;});
  }
  function setView(next) { if (drag) finishDrag(true); view = next; selection.clear(); lastSelected = null; render(); }
  function modalHeader(title, description = '') { return `<div class="modal-header"><div><h2 id="modal-title">${title}</h2>${description ? `<p>${description}</p>` : ''}</div><button class="icon-button" data-close aria-label="Close dialog">${icon('close')}</button></div>`; }
  function openModal(content) { $('modal-content').innerHTML = content; if (!$('modal').open) $('modal').showModal(); $('modal').scrollTop = 0; }
  function closeModal() { $('modal').close(); pendingImport = null; }
  $('modal').addEventListener('click', e => {if (e.target.closest('[data-close]')) closeModal();});
  $('modal').addEventListener('cancel', () => pendingImport = null);
  function field(label, name, value = '', options = {}) {
    const classes = `field ${options.full ? 'full' : ''} ${options.mobileFull ? 'mobile-full' : ''}`;
    const optional = options.required ? '' : ' <span class="optional">optional</span>';
    const common = `id="field-${name}" name="${name}" ${options.required ? 'required' : ''}`;
    const input = options.textarea ? `<textarea ${common} maxlength="10000" rows="4" placeholder="${escape(options.placeholder || '')}">${escape(value)}</textarea>` : `<input ${common} type="${options.type || 'text'}" value="${escape(value)}" maxlength="${options.max || 160}" placeholder="${escape(options.placeholder || '')}" ${options.min ? `min="${options.min}" step="1"` : ''}>`;
    return `<label class="${classes}"><span>${label}${optional}</span>${input}${options.help ? `<small>${options.help}</small>` : ''}</label>`;
  }
  function addModal(multiple = false) {
    openModal(`${modalHeader('Add rides', 'Use the catalog or enter ride details.')}<div class="modal-body"><div class="modal-tabs"><button id="single-tab" class="${multiple ? '' : 'active'}">One ride</button><button id="multiple-tab" class="${multiple ? 'active' : ''}">Add several</button></div><form id="ride-form">${multiple ? `<div class="form-grid">${field('Ride names','names','',{textarea:true,full:true,required:true,placeholder:'Ride name | Park name\nAnother ride | Another park',help:'One ride per line. Add a park after a | separator if you like.'})}</div><label class="inline-check"><input name="ranked" type="checkbox"> Add to the end of my ranking</label>` : rideFields()}<p id="form-error" class="form-error" role="alert" hidden></p></form></div><div class="modal-actions"><button class="button quiet" data-close>Cancel</button><button class="button primary" type="submit" form="ride-form">${multiple ? 'Add rides' : 'Add ride'}</button>${globalThis.TracklistQuiz ? '<button class="button" id="add-compare" type="submit" form="ride-form">Add & compare</button>' : ''}</div>`);
    $('single-tab').onclick = () => addModal(false); $('multiple-tab').onclick = () => addModal(true);
    if (globalThis.TracklistQuiz) {
      const help = document.createElement('p'); help.className='comparison-help'; help.textContent='Add & compare finds a place through the quiz and saves it automatically as you answer.'; $('ride-form').append(help);
    }
    $('ride-form').onsubmit = e => {
      e.preventDefault(); const data = new FormData(e.target), compare = e.submitter?.id === 'add-compare';
      try {
        const used = new Set(state.rides.map(r => r.id)); let added;
        if (multiple) {
          const lines = String(data.get('names')).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          if (!lines.length) throw new Error('Add at least one ride name.');
          if (lines.length + state.rides.length > C.LIMIT) throw new Error(`A collection can contain up to ${C.LIMIT.toLocaleString()} rides.`);
          added = lines.map(line => {const [name,...park] = line.split('|'); return C.ride({name,park:park.join('|'),ranked:data.has('ranked')},used);});
        } else added = [readRideForm(data, used)];
        if (compare) added = added.map(r=>({...r,ranked:false}));
        if (commit([...state.rides,...added], `${added.length === 1 ? added[0].name : `${added.length} rides`} added.`)) {view = added[0].ranked ? 'ranked' : 'unranked'; query=''; $('search').value=''; render(); closeModal(); if(compare)globalThis.TracklistQuiz.start({mode:'queue',ids:added.map(r=>r.id)});}
      } catch (error) { formError(error.message); }
    };
    if(!multiple)mountTrackFields({});
    document.dispatchEvent(new CustomEvent('tracklist:add-form',{detail:{multiple}}));
  }
  function rideFields(r = {}) {
    return `<div class="form-grid">${field('Ride name','name',r.name,{required:true,full:true,placeholder:'e.g. Steel Vengeance'})}${field('Park','park',r.park,{placeholder:'e.g. Cedar Point'})}${field('Country','country',r.country,{max:80,placeholder:'e.g. United States'})}<label class="field"><span>Coaster type</span><select id="field-type" name="type">${C.TYPES.map(t=>`<option ${r.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${field('Manufacturer','manufacturer',r.manufacturer,{max:100})}${field('First ridden','riddenOn',r.riddenOn,{type:'date',max:10})}${field('YouTube POV link','pov',r.pov,{type:'url',max:2000,mobileFull:true,placeholder:'https://youtube.com/watch?v=…'})}${field('RCDB ride page','rcdb',r.rcdb,{type:'url',max:2000,full:true,placeholder:'https://rcdb.com/123.htm'})}${field('Personal notes','notes',r.notes,{textarea:true,full:true,placeholder:'Seats, ride experience, or anything you want to remember'})}</div><div id="track-fields"></div><label class="inline-check"><input name="ranked" type="checkbox" ${r.ranked !== false ? 'checked' : ''}>${r.id ? 'Included in my ranking' : 'Add to the end of my ranking'}</label>`;
  }
  let formTracks=[];
  function readTrackForm(data,force=false){return data.has('multi-track')||force?formTracks.map((t,i)=>({...t,name:data.get('track-name-'+i),ridden:data.has('track-ridden-'+i),notes:data.get('track-notes-'+i)||'',riddenOn:data.get('track-date-'+i)||''})):[];}
  function mountTrackFields(r){
    if(!$('track-fields'))return;formTracks=JSON.parse(JSON.stringify(r.tracks?.length?r.tracks:[{id:C.uid(),name:'Track 1',ridden:true},{id:C.uid(),name:'Track 2',ridden:false}]));
    const enabled=!!r.tracks?.length;
    function draw(on,preferred=''){$('track-fields').innerHTML=`<section class="track-editor"><label class="inline-check"><input id="multi-track" name="multi-track" type="checkbox" ${on?'checked':''}>This ride has separate tracks</label><fieldset class="track-options" ${on?'':'disabled hidden'}><legend class="sr-only">Track credits</legend><p>Check each track you’ve ridden. Each counts as a credit; the ride keeps one ranking position. No selected track keeps one unspecified credit.</p>${formTracks.map((t,i)=>`<div class="track-editor-row"><label class="inline-check"><input name="track-ridden-${i}" type="checkbox" ${t.ridden?'checked':''}>Ridden</label><label class="field"><span>Track name</span><input name="track-name-${i}" maxlength="80" value="${escape(t.name)}" required></label><button class="button small quiet" type="button" data-remove-track="${i}" aria-label="Remove ${escape(t.name)} track">Remove</button><details><summary>Private track notes & date</summary><label class="field"><span>Track notes</span><textarea name="track-notes-${i}" maxlength="10000" rows="2">${escape(t.notes||'')}</textarea></label><label class="field"><span>First ridden on this track</span><input type="date" name="track-date-${i}" value="${escape(t.riddenOn||'')}"></label></details></div>`).join('')}<button class="button small" type="button" id="add-track" ${formTracks.length>=8?'disabled':''}>Add another track</button><label class="field"><span>Favorite track (optional)</span><select name="preferredTrack"><option value="">No preference</option>${formTracks.map(t=>`<option value="${escape(t.id)}" ${t.id===preferred?'selected':''}>${escape(t.name)}</option>`).join('')}</select><small>Favorites apply only to tracks you’ve marked ridden.</small></label><strong id="track-credit-preview" role="status"></strong></fieldset></section>`;
      $('multi-track').onchange=event=>{const data=new FormData($('ride-form'));if(!$('track-fields').querySelector('fieldset').disabled)formTracks=readTrackForm(data,true);if(!formTracks.length)formTracks=[{id:C.uid(),name:'Track 1',ridden:true},{id:C.uid(),name:'Track 2',ridden:false}];draw(event.target.checked,data.get('preferredTrack'));};
      const preview=()=>{const list=readTrackForm(new FormData($('ride-form'))),count=Math.max(1,list.filter(t=>t.ridden).length);$('track-credit-preview').textContent=`${count} ${count===1?'credit':'credits'} · 1 ranking item`;};
      $('track-fields').oninput=preview;preview();
      $('add-track').onclick=()=>{const data=new FormData($('ride-form'));formTracks=readTrackForm(data);formTracks.push({id:C.uid(),name:'Track '+(formTracks.length+1),ridden:false});draw(true,data.get('preferredTrack'));};
      $('track-fields').querySelectorAll('[data-remove-track]').forEach(b=>b.onclick=()=>{const data=new FormData($('ride-form'));formTracks=readTrackForm(data);formTracks.splice(Number(b.dataset.removeTrack),1);draw(!!formTracks.length,data.get('preferredTrack'));});
    }draw(enabled,r.preferredTrack);
    for(const name of ['name','park'])$('field-'+name).onchange=()=>{if($('multi-track').checked)return;const raw={name:$('field-name').value,park:$('field-park').value};if(C.trackFamily(raw))mountTrackFields(C.ride({...raw,ranked:false}));};
  }
  function readRideForm(data, used = new Set(), id) {
    const previous=id?state.rides.find(r=>r.id===id):null;
    const raw={...previous,...Object.fromEntries(data.entries()),tracks:readTrackForm(data),id:id || C.uid(),ranked:data.has('ranked'),demoRide:previous?.demoRide||false};
    if(globalThis.TracklistCatalog&&globalThis.TRACKLIST_CATALOG){const matching=TracklistCatalog.match(raw,TRACKLIST_CATALOG.rides);if(matching.match)return C.ride(TracklistCatalog.enrich(raw,matching.match),used);}
    return C.ride(raw,used);
  }
  function formError(message) { $('form-error').textContent = message; $('form-error').hidden = false; }
  function editModal(id, focusNotes = false) {
    const r = state.rides.find(r=>r.id===id); if (!r) return;
    const rank = state.rides.filter(r=>r.ranked).findIndex(x=>x.id===id)+1;
    const pov = r.pov || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${r.name} ${r.park} roller coaster POV`)}`;
    openModal(`${modalHeader('Your ride.', `${r.ranked ? `Rank #${rank}` : 'Unranked'} · ${escape(r.name)}`)}<div class="modal-body"><form id="ride-form">${rideFields(r)}<p id="form-error" class="form-error" role="alert" hidden></p></form><div class="mobile-rank edit-links"><button class="button" id="edit-rank">${r.ranked ? 'Move to rank…' : 'Rank this ride'}</button><a class="button" href="${escape(pov)}" target="_blank" rel="noopener noreferrer">${icon('play')}${r.pov ? 'Watch POV' : 'Find POV'}</a>${r.rcdb ? `<a class="button" href="${escape(r.rcdb)}" target="_blank" rel="noopener noreferrer">RCDB ↗</a>` : `<a class="button" href="https://rcdb.com/qs.htm?qs=${encodeURIComponent(`${r.name} ${r.park}`)}" target="_blank" rel="noopener noreferrer">Find RCDB ↗</a>`}</div></div><div class="modal-actions"><button class="button quiet danger" id="delete-ride">Delete</button><button class="button quiet" data-close>Cancel</button><button class="button primary" type="submit" form="ride-form">Save ride</button></div>`);
    $('ride-form').onsubmit = e => {
      e.preventDefault();
      try {
        const updated = readRideForm(new FormData(e.target),new Set(),id);
        if(commit(state.rides.map(x=>x.id===id ? updated : x),'Ride details saved.'))closeModal();
      } catch(error) {formError(error.message);}
    };
    mountTrackFields(r);
    const combine=document.createElement('button');combine.className='button';combine.id='combine-track-entries';combine.disabled=r.demoRide;combine.textContent='Combine separate track entries';$('ride-form').after(combine);combine.onclick=()=>combineModal(id);
    $('delete-ride').onclick = () => confirmModal('Delete this ride?', `${escape(r.name)} will be removed from your credits and ranking. You can undo this change.`, 'Delete ride', () => {commit(state.rides.filter(x=>x.id!==id),'Ride deleted.'); closeModal();}, () => editModal(id));
    $('edit-rank').onclick = () => {
      try {const updated = readRideForm(new FormData($('ride-form')),new Set(),id);if(commit(state.rides.map(x=>x.id===id?updated:x),'Ride details saved.'))rankModal(id);}
      catch(error) {formError(error.message);}
    };
    if (focusNotes) { $('field-notes').focus(); }
  }
  function combineModal(id){const primary=state.rides.find(r=>r.id===id),others=state.rides.filter(r=>r.id!==id&&!r.demoRide&&(C.sameRide(primary,r)||primary.park.trim().toLowerCase()===r.park.trim().toLowerCase()));
    openModal(`${modalHeader('Combine track entries',escape(primary.name))}<div class="modal-body"><p>Keep this ride’s ranking position and combine another entry into its tracks. Ridden tracks and private notes are kept. Undo can restore both entries.</p>${others.length?`<form id="combine-form"><label class="field"><span>Other track entry</span><select name="other" id="combine-other">${others.map(r=>`<option value="${escape(r.id)}">${escape(r.name)}</option>`).join('')}</select></label>${field('Combined ride name','combined-name',C.trackFamily(primary)?.name||primary.name,{required:true})}${field('This entry’s track name','primary-track',primary.tracks?.some(t=>t.ridden)?'Existing track names':primary.name,{required:true})}${field('Other entry’s track name','other-track',others[0].tracks?.some(t=>t.ridden)?'Existing track names':others[0].name,{required:true})}<p>Entries already containing named, ridden tracks keep those names. Otherwise give each track a distinct name.</p><p id="form-error" class="form-error" hidden role="alert"></p></form>`:'<p>No other credit entries from this park are available.</p>'}</div><div class="modal-actions"><button class="button quiet" id="combine-cancel">Back to ride</button>${others.length?'<button class="button primary" type="submit" form="combine-form">Combine tracks</button>':''}</div>`);
    $('combine-cancel').onclick=()=>editModal(id);if(!others.length)return;
    $('combine-other').onchange=event=>{const other=others.find(r=>r.id===event.target.value);$('field-other-track').value=other.tracks?.some(t=>t.ridden)?'Existing track names':other.name;};
    $('combine-form').onsubmit=event=>{event.preventDefault();try{const data=new FormData(event.target),other=state.rides.find(r=>r.id===data.get('other'));if(!other)throw Error('Choose an existing track entry.');const merged=C.ride({...C.combineRides(primary,other,[data.get('primary-track'),data.get('other-track')]),name:data.get('combined-name')});const inheritOther=!primary.ranked&&other.ranked;const rides=state.rides.flatMap(r=>r.id===other.id?(inheritOther?[merged]:[]):r.id===primary.id?(inheritOther?[]:[merged]):[r]);if(commit(rides,'Tracks combined into one ranking item.')){closeModal();editModal(primary.id);}}catch(error){formError(error.message);}};
  }
  function rankModal(id) {
    const r = state.rides.find(r=>r.id===id); if (!r) return;
    const ranked = state.rides.filter(r=>r.ranked), current = ranked.findIndex(x=>x.id===id)+1;
    const max = ranked.length + (r.ranked ? 0 : 1);
    openModal(`${modalHeader('Move ride', 'Move straight to a position. The other rides shift around it.')}<div class="modal-body"><div class="rank-preview">${art(r)}<div><strong>${escape(r.name)}</strong><small>${r.ranked ? `Currently ranked #${current}` : 'Currently unranked'}</small></div></div><form id="rank-form"><label class="field"><span>New rank <span class="optional">1–${max}</span></span><input type="number" name="rank" id="rank-input" min="1" max="${max}" step="1" value="${current || max}" required></label><p id="form-error" class="form-error" role="alert" hidden></p></form><div class="mobile-rank" style="display:flex"><button class="button" id="move-first">Move to #1</button><button class="button" id="move-last">Move to last</button></div></div><div class="modal-actions">${r.ranked ? '<button class="button quiet danger" id="unrank-ride">Unrank ride</button>' : ''}<button class="button quiet" data-close>Cancel</button><button class="button primary" type="submit" form="rank-form">Move ride</button></div>`);
    const apply = destination => {commit(C.move(state.rides,[id],destination),`${r.name} moved to #${destination}.`);closeModal();};
    $('rank-form').onsubmit = e => {e.preventDefault();apply(Number($('rank-input').value));};
    $('move-first').onclick = () => apply(1); $('move-last').onclick = () => apply(max);
    if (r.ranked) $('unrank-ride').onclick = () => {commit(C.unrank(state.rides,[id]),`${r.name} moved to Unranked.`);closeModal();};
    if (globalThis.TracklistQuiz) {
      const b = document.createElement('button'); b.className='button rank-compare'; b.id='rank-compare'; b.textContent=r.ranked ? 'Compare to rerank' : 'Rank by comparison';
      $('rank-form').after(b); b.onclick=()=>globalThis.TracklistQuiz.start({mode:'single',ids:[id]});
    }
    $('rank-input').focus(); $('rank-input').select();
  }
  function confirmModal(title, text, label, apply, cancel = closeModal) {
    openModal(`${modalHeader(title)}<div class="modal-body help-copy">${text}</div><div class="modal-actions"><button class="button quiet" id="confirm-cancel">Cancel</button><button class="button primary" id="confirm-action">${label}</button></div>`);
    $('confirm-action').onclick = apply; $('confirm-cancel').onclick = cancel;
  }
  function download(filename, contents, mime) {
    const url = URL.createObjectURL(new Blob([contents], {type:mime}));
    const link = document.createElement('a'); link.href=url; link.download=filename; document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function exportData(format='json') {
    const date = new Date().toISOString().slice(0,10);
    const data = format==='csv' ? C.exportCSV(state.rides) : JSON.stringify({...state, app:'Tracklist', exportedAt:new Date().toISOString()},null,2);
    download(`tracklist-${date}.${format}`,data,format==='csv' ? 'text/csv;charset=utf-8' : 'application/json');
    try {localStorage.setItem(EXPORT_KEY,new Date().toISOString());} catch {}
    toast(`${format.toUpperCase()} backup downloaded. Keep it somewhere safe.`,false);
  }
  function backupModal() {
    let lastExport='No backup exported yet'; try { const last=localStorage.getItem(EXPORT_KEY);if (last) lastExport=`Last export: ${new Date(last).toLocaleString()}`;} catch {}
    openModal(`${modalHeader('Data & backup', 'Export, import, or recover your collection.')}<div class="modal-body"><div class="backup-card"><h3>Export your collection</h3><p>JSON preserves your complete collection and order. CSV works with spreadsheets; text that could run as a formula is prefixed with an apostrophe.<br>${escape(lastExport)}</p><div class="backup-buttons"><button class="button primary" id="export-json">${icon('download')}Export JSON</button><button class="button" id="export-csv">Export CSV</button>${recoveryRaw ? '<button class="button" id="export-recovery">Download recovery file</button>' : ''}</div></div><div class="backup-card"><h3>Import a collection</h3><p>Choose a Tracklist JSON backup, or a CSV with a Name, Ride, or Coaster column. Optional columns: Park, Rank, Type, Country, Manufacturer, Notes, POV, Ridden On. Blank ranks go to Unranked. You’ll review before importing.</p><input id="import-file" type="file" accept=".json,.csv,.tsv,.txt,application/json,text/csv" class="sr-only"><label class="button file-label" for="import-file">Choose a file</label><p id="import-error" class="form-error" role="alert" hidden></p></div><p class="privacy-note">Automatic saving uses this browser’s local storage. Clearing site data or using private browsing can remove it. Sign in through Account for cross-device cloud saving. Keep exported JSON backups for safekeeping; JSON also includes your wish list. CSV exports contain credits.</p>${storageBlocked ? '<button class="button quiet" id="reset-storage">Start a new collection</button>' : ''}</div><div class="modal-actions"><button class="button quiet" data-close>Done</button></div>`);
    $('export-json').onclick = () => exportData(); $('export-csv').onclick = () => exportData('csv');
    if ($('export-recovery')) $('export-recovery').onclick = () => download('tracklist-recovery.json',recoveryRaw,'application/json');
    if ($('reset-storage')) $('reset-storage').onclick = () => confirmModal('Start a new collection?', 'This replaces the unreadable saved data. Download the recovery file first if you need to keep it.', 'Start new collection',()=>{storageBlocked=false;commit([],'New collection ready.',false);closeModal();},backupModal);
    $('import-file').onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      const input = e.target;
      try {
        if(file.size>15*1024*1024) throw new Error('Choose a file smaller than 15 MB.');
        input.disabled=true;
        const text=await file.text();
        if(!input.isConnected || !$('modal').open)return;
        pendingImport=C.importText(text,file.name);importReview(file.name);
      } catch(error) {
        if(!input.isConnected || !$('modal').open)return;
        $('import-error').textContent=error.message; $('import-error').hidden=false; input.value='';
      } finally {input.disabled=false;}
    };
    document.dispatchEvent(new Event('tracklist:backup'));
  }
  function importReview(filename) {
    const imported=pendingImport, merged=C.merge(state.rides,imported.rides,true);
    const ranked=imported.rides.filter(r=>r.ranked).length;
    openModal(`${modalHeader('Your import is ready.',escape(filename))}<div class="modal-body"><div class="review-summary"><strong>${C.creditCount(imported.rides)} credits · ${imported.rides.length} rides</strong> · ${ranked} ranked · ${imported.rides.length-ranked} unranked<br>${merged.added} new rides · ${merged.skipped} matching rides already in your collection</div><form id="import-form"><label class="radio-choice"><input type="radio" name="mode" value="merge" ${!state.demo&&!storageBlocked?'checked':''}><span><strong>Merge into my collection</strong><small>Keep existing rides and their order. Add new ranked rides at the end. Matching rides keep their ranking and notes; extra ridden tracks are merged.</small></span></label><label class="radio-choice"><input type="radio" name="mode" value="replace" ${state.demo||storageBlocked?'checked':''}><span><strong>Replace my collection</strong><small>Use the imported collection and its ranking. Your current collection is replaced. Undo is available.</small></span></label><p id="form-error" class="form-error" role="alert" hidden></p></form></div><div class="modal-actions"><button class="button quiet" id="import-back">Back</button><button class="button primary" type="submit" form="import-form">Import ${imported.rides.length} rides</button></div>`);
    $('import-back').onclick=backupModal;
    $('import-form').onsubmit=e=>{
      e.preventDefault();const mode=new FormData(e.target).get('mode');
      try {
        const result=mode==='replace'?{rides:imported.rides,added:imported.rides.length,skipped:0}:C.merge(state.rides,imported.rides);
        const wishlist=mode==='replace'?imported.wishlist:C.merge(state.wishlist,imported.wishlist).rides.map(r=>({...r,ranked:false}));
        storageBlocked=false;
        if(commit(result.rides,`${result.added} rides imported${result.skipped?`; ${result.skipped} duplicates skipped`:''}.`,false,wishlist,mode==='replace'?imported.parkWishlist:C.parkList([...state.parkWishlist,...imported.parkWishlist]))){selection.clear();query='';$('search').value='';view='ranked';render();closeModal();}
      }catch(error){formError(error.message);}
    };
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  $('search').addEventListener('input',e=>{query=e.target.value;selection.clear();lastSelected=null;render();});
  $('add-button').onclick=()=>{if(view==='wishlist')document.dispatchEvent(new Event('tracklist:wish-picker'));else if(view==='all')addModal();}; $('backup-button').onclick=backupModal; $('footer-backup').onclick=backupModal;
  $('export-top').onclick=()=>exportData();
  $('clear-demo').onclick=()=>confirmModal('Remove sample rides?', 'This removes the sample rides. Any rides you added are kept. You can undo this change.', 'Start my own list',()=>{selection.clear();query='';$('search').value='';commit(state.rides.filter(r=>!r.demoRide),'Sample rides cleared. Your collection is ready.',false);closeModal();if(!state.rides.length){view='all';render();addModal();}});
  $('undo-button').onclick=undo; $('toast-undo').onclick=undo; $('toast-close').onclick=()=>$('toast').hidden=true;
  $('select-all').onchange=e=>{visibleRides().forEach(r=>e.target.checked?selection.add(r.id):selection.delete(r.id));renderSelection();};
  $('clear-selection').onclick=()=>{selection.clear();renderSelection();};
  $('bulk-move').onclick=()=>{
    const input=$('bulk-rank');if(!input.reportValidity())return;
    const count=selection.size;commit(C.move(state.rides,[...selection],Number(input.value)),`${count} rides moved to #${input.value}.`);selection.clear();renderSelection();
  };
  $('bulk-unrank').onclick=()=>{const count=selection.size;commit(C.unrank(state.rides,[...selection]),`${count} rides moved to Unranked.`);selection.clear();renderSelection();};
  $('ride-list').addEventListener('click',e=>{
    const action=e.target.closest('[data-action]'), row=e.target.closest('.ride-row');
    if(e.target.matches('.ride-select')&&row){
      const id=row.dataset.id, checked=e.target.checked;
      const visible=visibleRides().map(r=>r.id),a=visible.indexOf(lastSelected),b=visible.indexOf(id);
      const range=e.shiftKey&&a>=0?visible.slice(Math.min(a,b),Math.max(a,b)+1):[id];
      range.forEach(x=>checked?selection.add(x):selection.delete(x));lastSelected=id;renderSelection();return;
    }
    if(!action)return;
    const id=row?.dataset.id;
    if(action.dataset.action==='rank')rankModal(id);
    else if(['edit','notes'].includes(action.dataset.action))editModal(id,action.dataset.action==='notes');
    else if(action.dataset.action==='add'&&view==='all')addModal();
    else if(action.dataset.action==='credits')setView('all');
    else if(action.dataset.action==='backup')backupModal();
    else if(action.dataset.action==='clear-search'){query='';$('search').value='';render();$('search').focus();}
  });
  document.addEventListener('keydown',e=>{
    const typing=e.target.matches('input,textarea,select,[contenteditable]');
    if(e.key==='Escape'&&drag){finishDrag(true);return;}
    if(!typing&&!$('modal').open&&e.key==='/'){e.preventDefault();$('search').focus();}
    if(!typing&&!$('modal').open&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
    const handle=e.target.closest('[data-action="drag"]');
    if(!handle||!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    e.preventDefault();const id=handle.closest('.ride-row').dataset.id;
    const ranked=state.rides.filter(r=>r.ranked),current=ranked.findIndex(r=>r.id===id)+1;
    const next=e.key==='Home'?1:e.key==='End'?ranked.length:Math.min(ranked.length,Math.max(1,current+(e.key==='ArrowUp'?-1:1)));
    if(next===current)return;
    const name=ranked[current-1].name;commit(C.move(state.rides,[id],next),`${name} moved to #${next}.`);
    [...document.querySelectorAll('.ride-row')].find(row=>row.dataset.id===id)?.querySelector('.drag-handle').focus({preventScroll:true});
  });
  // Pointer events give the same drag interaction to mouse, pen, and touch.
  $('ride-list').addEventListener('pointerdown',e=>{
    const handle=e.target.closest('[data-action="drag"]');if(!handle||e.button!==0)return;
    const row=handle.closest('.ride-row');
    drag={id:row.dataset.id,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,active:false,target:null,after:false,handle};
    handle.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove',e=>{
    if(!drag||drag.pointerId!==e.pointerId)return;
    drag.x=e.clientX;drag.y=e.clientY;
    if(!drag.active&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5){
      drag.active=true;document.body.classList.add('is-dragging');
      const row=[...document.querySelectorAll('.ride-row')].find(r=>r.dataset.id===drag.id);row?.classList.add('dragging');
      const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=state.rides.find(r=>r.id===drag.id).name;document.body.append(ghost);drag.ghost=ghost;
      dragFrame=requestAnimationFrame(dragTick);
    }
    if(drag.active){e.preventDefault();updateDragTarget();}
  },{passive:false});
  function updateDragTarget(){
    if(!drag?.active)return;
    drag.ghost.style.left=`${Math.min(drag.x+15,window.innerWidth-180)}px`;drag.ghost.style.top=`${drag.y-20}px`;
    document.querySelectorAll('.drop-before,.drop-after').forEach(r=>r.classList.remove('drop-before','drop-after'));
    const row=document.elementFromPoint(drag.x,drag.y)?.closest('.ride-row');
    drag.target=null;
    if(row&&row.dataset.id!==drag.id&&row.dataset.position){const rect=row.getBoundingClientRect();drag.target=row.dataset.id;drag.after=drag.y>rect.top+rect.height/2;row.classList.add(drag.after?'drop-after':'drop-before');}
  }
  function dragTick(){
    if(!drag?.active)return;
    const edge=75,top=window.innerWidth<=640?70:0;
    if(drag.y<top+edge)window.scrollBy(0,-Math.ceil((top+edge-drag.y)/7));
    else if(drag.y>window.innerHeight-edge)window.scrollBy(0,Math.ceil((drag.y-window.innerHeight+edge)/7));
    updateDragTarget();dragFrame=requestAnimationFrame(dragTick);
  }
  function finishDrag(cancel=false){
    if(!drag)return;const d=drag;drag=null;cancelAnimationFrame(dragFrame);d.ghost?.remove();document.body.classList.remove('is-dragging');
    document.querySelectorAll('.dragging,.drop-before,.drop-after').forEach(r=>r.classList.remove('dragging','drop-before','drop-after'));
    if(d.handle.hasPointerCapture(d.pointerId))d.handle.releasePointerCapture(d.pointerId);
    if(!cancel&&d.active&&d.target){const remaining=state.rides.filter(r=>r.ranked&&r.id!==d.id);const target=remaining.findIndex(r=>r.id===d.target);const destination=target+1+(d.after?1:0);const current=state.rides.filter(r=>r.ranked).findIndex(r=>r.id===d.id)+1;if(target>=0&&destination!==current)commit(C.move(state.rides,[d.id],destination),`${state.rides.find(r=>r.id===d.id).name} moved to #${destination}.`);}
  }
  document.addEventListener('pointerup',e=>{if(drag?.pointerId===e.pointerId)finishDrag();});
  document.addEventListener('pointercancel',e=>{if(drag?.pointerId===e.pointerId)finishDrag(true);});
  window.addEventListener('blur',()=>finishDrag(true));
  window.addEventListener('storage',e=>{
    if(e.key!==STORAGE||!e.newValue)return;
    try{const next=C.normalize(JSON.parse(e.newValue));finishDrag(true);state=next;history=[];selection.clear();storageBlocked=false;saveFailed=false;$('storage-warning').hidden=true;if($('modal').open)closeModal();render();toast('Collection updated from another tab.',false);}catch{showStorageWarning('Another tab changed the saved data to an unreadable format. Export your current collection before continuing.');storageBlocked=true;saveFailed=true;updateSaveStatus();}
  });
  globalThis.TracklistApp={getState:()=>JSON.parse(JSON.stringify(state)),getView:()=>view,getStorageKey:()=>STORAGE,escape,icon,art,openModal,closeModal,modalHeader,toast,setView,rankModal,editModal,backupModal,exportData,mountTrackFields,
    change:(patch,message)=>commit(patch.rides||state.rides,message,state.demo,patch.wishlist||state.wishlist,patch.parkWishlist||state.parkWishlist),
    restore:(next,message)=>{const data=C.normalize(next);return commit(data.rides,message,data.demo,data.wishlist,data.parkWishlist);},
    switchAccount:(uid)=>{
      persist();const current=state,fromGuest=STORAGE==='tracklist.collection.v1';STORAGE=uid?`tracklist.collection.v1.${uid}`:'tracklist.collection.v1';
      let saved=null;try{saved=localStorage.getItem(STORAGE);}catch{}
      recoveryRaw='';try{state=saved?C.normalize(JSON.parse(saved)):C.normalize({version:1,rides:uid&&fromGuest?current.rides.filter(r=>!r.demoRide):[],wishlist:uid&&fromGuest?current.wishlist:[],parkWishlist:uid&&fromGuest?current.parkWishlist:[]});storageBlocked=false;}catch{state=C.normalize({version:1,rides:[]});storageBlocked=true;showStorageWarning('This account’s local save is unreadable. Export a recovery file before replacing it.');recoveryRaw=saved||'';}
      history=[];selection.clear();if($('modal').open)closeModal();view='ranked';query='';$('search').value='';persist();render();return {hasLocal:!!saved,unreadable:storageBlocked,meaningful:!!(state.rides.length||state.wishlist.length||state.parkWishlist.length)&&!state.demo};
    },
    applyRemote:next=>{checkpoint(true);state=C.normalize(next);storageBlocked=false;history=[];selection.clear();if($('modal').open)closeModal();persist();render();},
  };
  render(); if(!storageBlocked)persist();else updateSaveStatus();
})();
