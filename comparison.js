(() => {
  'use strict';
  const A = globalThis.TracklistApp, C = globalThis.Tracklist, Q = globalThis.TracklistComparison;
  if (!A || !C || !Q) return;
  const $ = id => document.getElementById(id), esc = A.escape;
  const signature = () => JSON.stringify(A.getState().rides.map(r => [r.id,r.ranked]));
  let owner = A.getStorageKey(), session = null, applying = false, durable = true, lastPlacement = null, notice = '';
  const key = () => owner + '.comparison';
  const active = () => $('modal').open && !!$('comparison-session');
  function anchors(s = session) {
    const rides = A.getState().rides, target = s.queue[s.index];
    return s.mode === 'full' ? s.placed.map(id => rides.find(r => r.id === id)) : rides.filter(r => r.ranked && r.id !== target);
  }
  function load() {
    session = null; durable = true; lastPlacement = null; notice = '';
    try {
      const raw = localStorage.getItem(key());
      if (!raw) return;
      const s = JSON.parse(raw), ids = new Set(A.getState().rides.map(r => r.id));
      const list = value => Array.isArray(value) && value.length <= C.LIMIT && new Set(value).size === value.length && value.every(id => typeof id === 'string' && ids.has(id));
      if (s.version !== 1 || !['single','queue','full'].includes(s.mode) || !list(s.queue) || !s.queue.length || !list(s.placed) || !list(s.skipped) || !Number.isInteger(s.index) || s.index < 0 || s.index >= s.queue.length || s.expected !== signature()) throw new Error('Stale quiz.');
      const finished = s.queue.slice(0,s.index);
      if (s.placed.length + s.skipped.length !== s.index || finished.some(id => !s.placed.includes(id) && !s.skipped.includes(id)) || s.placed.some(id => s.skipped.includes(id)) || (s.mode === 'single' && s.queue.length !== 1)) throw new Error('Invalid progress.');
      if (!Array.isArray(s.answers)) throw new Error('Invalid answers.');
      Q.search(anchors(s).length,s.answers);
      session = s;
    } catch { try { localStorage.removeItem(key()); } catch {} }
  }
  function persist() {
    try {
      if (session) localStorage.setItem(key(),JSON.stringify(session));
      else localStorage.removeItem(key());
      durable = true;
    } catch { durable = false; }
    updateButton();
  }
  function updateButton() {
    const b = $('compare-button');
    if (b) { b.textContent = session ? 'Resume comparison quiz' : 'Rank by comparison'; b.disabled = !A.getState().rides.length; }
  }
  function storageCopy() {
    return durable ? 'Ranks save automatically using your usual saving settings. Paused quiz progress stays on this device; it isn’t included in backups.' : 'Quiz progress could not be saved on this device. Keep this tab open to resume. Ranks use your usual saving settings.';
  }
  function start({mode = 'queue',ids} = {}) {
    if (!['single','queue','full'].includes(mode)) return;
    const rides = A.getState().rides;
    const queue = ids ? rides.filter(r => ids.includes(r.id)).map(r => r.id) : rides.filter(r => mode === 'full' || !r.ranked).map(r => r.id);
    if (!queue.length || (mode === 'single' && queue.length !== 1)) { A.toast('Choose a ride to compare.',false); return; }
    const begin = () => {
      lastPlacement = null; notice = '';
      session = {version:1,mode,queue,index:0,placed:[],skipped:[],answers:[],expected:signature()};
      persist(); render();
    };
    if (session) {
      A.openModal(`${A.modalHeader('Start a new quiz?')}<div class="modal-body comparison-body"><p>This replaces your paused quiz. Saved rankings are kept.</p></div><div class="modal-actions"><button class="button quiet" id="comparison-keep">Keep paused quiz</button><button class="button primary" id="comparison-restart">Start new quiz</button></div>`);
      $('comparison-keep').onclick = () => render(); $('comparison-restart').onclick = begin;
    } else begin();
  }
  function choices() {
    const rides = A.getState().rides, unranked = rides.filter(r => !r.ranked);
    A.openModal(`${A.modalHeader('Rank by comparison','Choose which rides to work through.')}<div class="modal-body comparison-body comparison-modes">${session ? `<button class="comparison-mode" id="comparison-resume"><strong>Resume paused quiz</strong><span>${session.index} of ${session.queue.length} rides reviewed</span></button>` : ''}<button class="comparison-mode" id="comparison-unranked" ${unranked.length ? '' : 'disabled'}><strong>Rank unranked credits</strong><span>${unranked.length} rides · keep your existing ranking as the reference</span></button><div class="comparison-one"><label class="field" for="comparison-ride"><span>Rerank one ride</span><select id="comparison-ride">${rides.map(r => `<option value="${esc(r.id)}">${esc(r.name)}${r.park ? ' · '+esc(r.park) : ''}</option>`).join('')}</select></label><button class="button" id="comparison-single" ${rides.length ? '' : 'disabled'}>Compare this ride</button></div><button class="comparison-mode" id="comparison-full" ${rides.length ? '' : 'disabled'}><strong>Rebuild the whole ranking</strong><span>Compare all ${rides.length} credits from scratch. Save as you go and pause anytime.</span></button><p class="comparison-help">Choose the ride you prefer. Each answer narrows the position; strong answers move the next question closer to the top or bottom. A normal search takes at most ${Math.ceil(Math.log2(Math.max(1,rides.length+1)))} comparisons per ride for this collection.</p><p class="privacy-note">${storageCopy()}</p></div><div class="modal-actions"><button class="button quiet" data-close>Close</button></div>`);
    if ($('comparison-resume')) $('comparison-resume').onclick = () => render();
    $('comparison-unranked').onclick = () => start({mode:'queue'});
    $('comparison-single').onclick = () => start({mode:'single',ids:[$('comparison-ride').value]});
    $('comparison-full').onclick = () => start({mode:'full'});
  }
  function card(r, label, rank) {
    const pov = r.pov || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${r.name} ${r.park} roller coaster POV`)}`;
    const rcdb = r.rcdb || `https://rcdb.com/qs.htm?qs=${encodeURIComponent(`${r.name} ${r.park}`)}`;
    return `<article class="comparison-card"><span class="comparison-label">${label}</span><h3 title="${esc(r.name)}">${esc(r.name)}</h3><p title="${esc(r.park)}">${esc(r.park || 'Park not specified')}</p><small>${esc(rank)}</small><details><summary>Notes & links</summary>${r.notes ? `<p class="comparison-notes">${esc(r.notes)}</p>` : ''}<div class="comparison-links"><a href="${esc(pov)}" target="_blank" rel="noopener noreferrer">${r.pov ? 'Watch POV' : 'Find POV'} ↗</a><a href="${esc(rcdb)}" target="_blank" rel="noopener noreferrer">${r.rcdb ? 'RCDB' : 'Find RCDB'} ↗</a></div></details></article>`;
  }
  function render(focusId) {
    if (!session) { choices(); return; }
    const rides = A.getState().rides, target = rides.find(r => r.id === session.queue[session.index]);
    const refs = anchors(), search = Q.search(refs.length,session.answers), full = session.mode === 'full';
    // No confirmation screen: the final answer saves immediately and advances the queue.
    if (search.done) { save(target,refs,search.position); return; }
    const current = rides.filter(r => r.ranked).findIndex(r => r.id === target.id)+1;
    const title = full ? 'Rebuild your ranking' : session.mode === 'single' ? 'Find this ride’s place' : 'Rank your unranked credits';
    const opening = !active();
    if (opening) {
      A.openModal(`${A.modalHeader(title)}
        <div id="comparison-session" class="modal-body comparison-body comparison-fast">
          <div class="comparison-progress"><span id="comparison-progress-text"></span><progress id="comparison-progress" aria-label="Rides reviewed"></progress></div>
          <p id="comparison-notice" class="comparison-notice"></p>
          <p id="comparison-question" class="comparison-question">Rank the highlighted ride above or below the reference?</p>
          <div class="comparison-pair"><div id="comparison-target" class="comparison-target"></div><div id="comparison-reference"></div></div>
          <div class="comparison-answers" role="group" aria-labelledby="comparison-question">
            <button class="button comparison-up" data-comparison-answer="much-better"><strong>⇈ Much higher</strong><span>Much better <kbd>1</kbd></span></button>
            <button class="button comparison-up" data-comparison-answer="better"><strong>↑ Rank higher</strong><span>I prefer the highlighted ride <kbd>2</kbd></span></button>
            <button class="button comparison-down" data-comparison-answer="worse"><strong>↓ Rank lower</strong><span>I prefer the reference ride <kbd>3</kbd></span></button>
            <button class="button comparison-down" data-comparison-answer="much-worse"><strong>⇊ Much lower</strong><span>Much worse <kbd>4</kbd></span></button>
          </div>
          <p id="comparison-range" class="comparison-help"></p>
          <details class="comparison-info"><summary>Saving & shortcuts</summary><p id="comparison-storage" class="privacy-note"></p><p class="comparison-help">↑ / ↓ = higher / lower · Shift + ↑ / ↓ = much higher / lower. Keys 1–4 work too. Positions save automatically; Undo last ride lets you correct the latest placement.</p></details>
          <p id="comparison-storage-warning" class="form-error" role="alert" hidden></p>
        </div>
        <div class="modal-actions comparison-actions"><button class="button quiet" id="comparison-back">Back</button><button class="button quiet" id="comparison-skip">Skip ride</button><button class="button quiet" id="comparison-pause">Pause</button></div>`);
      // Keep these buttons in place across questions, so rapid taps and keyboard focus stay stable.
      document.querySelectorAll('[data-comparison-answer]').forEach(b => b.onclick = () => answer(b.dataset.comparisonAnswer));
      $('comparison-back').onclick = () => {
        if (session.answers.length) { session.answers.pop(); persist(); render('comparison-back'); }
        else undoPlacement();
      };
      $('comparison-skip').onclick = () => { lastPlacement = null; session.skipped.push(session.queue[session.index]); notice = 'Ride skipped. Its ranking is unchanged.'; advance(); };
      $('comparison-pause').onclick = () => { A.closeModal(); A.toast('Quiz paused. Resume from your ranking.',false); };
    }
    $('comparison-progress-text').textContent = `Ride ${session.index+1} of ${session.queue.length} · ${session.placed.length} ranked${session.skipped.length ? ' · '+session.skipped.length+' skipped' : ''}`;
    $('comparison-progress').max = session.queue.length; $('comparison-progress').value = session.index;
    $('comparison-notice').textContent = notice || 'Positions save automatically. Keep answering to move to the next ride.';
    const updateCard = (id,r,label,rank) => {
      const el = $(id), content = card(r,label,rank);
      if (el.comparisonContent !== content) { el.innerHTML = content; el.comparisonContent = content; }
    };
    updateCard('comparison-target',target,'Ranking now',current ? 'Currently #'+current : 'Unranked credit');
    updateCard('comparison-reference',refs[search.pivot],'Reference ride','#'+(search.pivot+1)+(full ? ' in this rebuild' : ' in your ranking'));
    $('comparison-range').textContent = `Possible rank: #${search.low+1}–#${search.high+1} · ${session.answers.length} answers`;
    $('comparison-storage').textContent = storageCopy();
    $('comparison-storage-warning').hidden = durable;
    $('comparison-storage-warning').textContent = durable ? '' : storageCopy();
    $('comparison-back').textContent = session.answers.length ? 'Back one answer' : 'Undo last ride';
    $('comparison-back').disabled = !session.answers.length && !lastPlacement;
    if (opening || (focusId === 'comparison-back' && $('comparison-back').disabled)) document.querySelector('[data-comparison-answer="better"]').focus({preventScroll:true});
    $('announcement').textContent = `${notice ? notice+' ' : ''}Rank ${target.name} higher or lower than ${refs[search.pivot].name}? Possible rank ${search.low+1} to ${search.high+1}.`;
  }
  function answer(value) {
    if (!session || !Q.ANSWERS.includes(value) || Q.search(anchors().length,session.answers).done) return;
    session.answers.push(value); persist(); render(value);
  }
  function save(target,refs,position) {
    const placed = session.mode === 'full' ? [...session.placed] : refs.map(r => r.id);
    placed.splice(position,0,target.id);
    const rides = A.getState().rides;
    const next = session.mode === 'full' ? Q.weave(rides,placed) : C.move(rides,[target.id],position+1);
    const previous = refs.length ? {order:rides.map(({id,ranked})=>({id,ranked})),progress:JSON.parse(JSON.stringify({...session,answers:session.answers.slice(0,-1)}))} : null;
    applying = true;
    let ok;
    try { ok = A.change({rides:next},`${target.name} ranked${session.mode === 'full' ? ' in your rebuild' : ' #'+(position+1)}.`); }
    finally { applying = false; }
    if (!ok) {
      if (session.answers.length) { session.answers.pop(); persist(); render(); A.toast('Position could not be saved. Try the answer again.',false); }
      else {
        A.openModal(`${A.modalHeader('Couldn’t save this ride')}<div class="modal-body comparison-body"><p>Your collection has not changed. Try again or pause the quiz.</p></div><div class="modal-actions"><button class="button quiet" data-close>Pause</button><button class="button primary" id="comparison-retry">Try again</button></div>`);
        $('comparison-retry').onclick = () => render();
      }
      return;
    }
    session.placed = session.mode === 'full' ? placed : [...session.placed,target.id];
    session.expected = signature();
    lastPlacement = previous ? {...previous,expected:session.expected} : null;
    const rank = A.getState().rides.filter(r=>r.ranked).findIndex(r=>r.id===target.id)+1;
    notice = `${target.name} saved at #${rank}.`;
    advance();
  }
  function undoPlacement() {
    if (!lastPlacement || lastPlacement.expected !== signature()) return;
    const previous = lastPlacement;
    applying = true;
    let ok;
    const current = new Map(A.getState().rides.map(r=>[r.id,r]));
    const rides = previous.order.map(({id,ranked})=>({...current.get(id),ranked}));
    try { ok = A.change({rides},'Last quiz placement undone.'); }
    finally { applying = false; }
    if (!ok) return;
    session = previous.progress; session.expected = signature(); lastPlacement = null;
    notice = 'Last placement undone. Change your final answer.';
    persist(); render();
  }
  function advance() {
    session.index++; session.answers = [];
    if (session.index < session.queue.length) { persist(); render(); return; }
    const {placed,skipped} = session;
    const ranked=A.getState().rides.filter(r=>r.ranked),placedIds=new Set(placed);
    const results=ranked.map((ride,index)=>({ride,rank:index+1})).filter(({ride})=>placedIds.has(ride.id));
    const result=results.length===1?results[0]:null;
    const placements=result
      ? `<div class="comparison-result"><span>Placed in your ranking</span><strong>#${result.rank}</strong><h3>${esc(result.ride.name)}</h3><p>of ${ranked.length} ranked ${ranked.length===1?'ride':'rides'}</p></div>`
      : results.length?`<h3>Your placements</h3><ol class="comparison-placements">${results.map(({ride,rank})=>`<li><strong>#${rank}</strong><span>${esc(ride.name)}</span></li>`).join('')}</ol>`:'<p>No rides were ranked this time.</p>';
    session = null; persist();
    A.openModal(`${A.modalHeader('Quiz complete')}<div class="modal-body comparison-body">${placements}<p>${results.length?'Your ranking is saved.':''}${skipped.length?' '+skipped.length+' skipped. Skipped rides keep their previous ranking status.':''}</p></div><div class="modal-actions">${lastPlacement ? '<button class="button quiet" id="comparison-undo-final">Undo last ride</button>' : ''}<button class="button primary" id="comparison-done">View ranking</button></div>`);
    if ($('comparison-undo-final')) $('comparison-undo-final').onclick = undoPlacement;
    $('comparison-done').onclick = () => { A.closeModal(); A.setView('ranked'); };
    $('comparison-done').focus();
  }
  document.addEventListener('tracklist:render',() => {
    if (applying) return;
    if (lastPlacement && lastPlacement.expected !== signature()) lastPlacement = null;
    if (owner !== A.getStorageKey()) { owner = A.getStorageKey(); load(); }
    else if (session && session.expected !== signature()) {
      const wasActive = active(); session = null; persist();
      if (wasActive) { A.closeModal(); A.toast('Your ranking changed. Start a fresh comparison quiz with the updated list.',false); }
    }
    updateButton();
  });
  window.addEventListener('storage',e => {
    if (e.key !== key()) return;
    const wasActive = active(); load(); updateButton();
    if (wasActive) { A.closeModal(); A.toast('Quiz progress changed in another tab. Resume to continue.',false); }
  });
  document.addEventListener('keydown',e => {
    if (!active() || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.matches('input,textarea,select,[contenteditable]') || e.target.closest('details')) return;
    const index = ['1','2','3','4'].indexOf(e.key);
    const value = index >= 0 ? Q.ANSWERS[index] : e.key === 'ArrowUp' ? (e.shiftKey ? 'much-better' : 'better') : e.key === 'ArrowDown' ? (e.shiftKey ? 'much-worse' : 'worse') : null;
    if (value) { e.preventDefault(); answer(value); }
  });
  globalThis.TracklistQuiz = {start,choices};
  $('compare-button').onclick = choices;
  load(); updateButton();
})();
